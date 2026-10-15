
import type { RuleValidator } from "../rule.types.js";

// ======================================================
// RULE: TƯƠNG TÁC DVKT - X-QUANG NGỰC
//
// Nhóm A: Chụp X-quang ngực thẳng
// Nhóm B: Chụp X-quang ngực nghiêng/chếch
//
// Không cho phép hai nhóm đồng thời trong cùng hồ sơ.
// Chỉ áp dụng GENERAL - XML3.
// ======================================================

const DEFAULT_GROUP_A = [
  "18.0119.0029",
  "18.0119.0028",
];

const DEFAULT_GROUP_B = [
  "18.0120.0028",
];

type RuleConfig = {
  groupACodes?: string[];
  groupBCodes?: string[];
  treatmentGroup?: string;
  note?: string;
};

type EventRow = {
  treatment_group: string | null;
  item_code: string | null;
  item_name: string | null;
};

type MatchedService = {
  code: string;
  name: string;
};

function normalize(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toUpperCase();
}

function readCodes(
  value: unknown,
  defaults: string[]
): string[] {
  if (!Array.isArray(value)) {
    return [...defaults];
  }

  return Array.from(
    new Set(
      value
        .filter(
          (item): item is string =>
            typeof item === "string"
        )
        .map(normalize)
        .filter(Boolean)
    )
  );
}

function matchServices(
  rows: EventRow[],
  allowed: Set<string>
): MatchedService[] {
  const matches =
    new Map<string, MatchedService>();

  for (const row of rows) {
    const code = normalize(row.item_code);

    if (!allowed.has(code)) {
      continue;
    }

    if (!matches.has(code)) {
      matches.set(code, {
        code,
        name:
          String(row.item_name ?? "").trim() ||
          code,
      });
    }
  }

  return Array.from(matches.values()).sort(
    (a, b) => a.code.localeCompare(b.code)
  );
}

export const serviceChestXrayExclusionRule:
  RuleValidator = {
  async evaluate(context, rule, runtime) {
    const config = (rule.config ?? {}) as RuleConfig;

    const groupACodes = readCodes(
      config.groupACodes,
      DEFAULT_GROUP_A
    );

    const groupBCodes = readCodes(
      config.groupBCodes,
      DEFAULT_GROUP_B
    );

    const caseId = context.medicalCase?.id;

    const caseGroup = normalize(
      (
        context.medicalCase as
          typeof context.medicalCase & {
            treatment_group?: string | null;
          }
      ).treatment_group
    );

    const baseDetails = {
      interactionType: "MUTUALLY_EXCLUSIVE",
      treatmentGroup: "GENERAL",
      groupACodes,
      groupBCodes,
      violations: [],
    };

    const makeResult = (
      status: "PASS" | "FAIL" | "SKIP",
      issueCount: number,
      message: string,
      details: Record<string, unknown>
    ) => ({
      ruleId: rule.id,
      ruleCode: rule.code,
      status,
      severity: rule.severity,
      issueCount,
      message,
      details,
    });

    // ==================================================
    // 1. KHÔNG ÁP DỤNG CHO YHCT
    // ==================================================

    if (caseGroup === "YHCT") {
      return makeResult(
        "SKIP",
        0,
        "Quy luật X-quang ngực không áp dụng cho YHCT.",
        {
          ...baseDetails,
          skipReason: "NOT_GENERAL",
        }
      );
    }

    if (!caseId) {
      return makeResult(
        "SKIP",
        0,
        "Không xác định được hồ sơ cần kiểm tra.",
        {
          ...baseDetails,
          skipReason: "MISSING_CASE_ID",
        }
      );
    }

    // ==================================================
    // 2. KIỂM TRA CẤU HÌNH
    // ==================================================

    if (
      groupACodes.length === 0 ||
      groupBCodes.length === 0
    ) {
      return makeResult(
        "SKIP",
        0,
        "Chưa cấu hình đầy đủ hai nhóm DVKT X-quang.",
        {
          ...baseDetails,
          skipReason: "EMPTY_SERVICE_CODES",
        }
      );
    }

    const groupASet = new Set(groupACodes);
    const groupBSet = new Set(groupBCodes);

    const duplicated = groupBCodes.filter(
      (code) => groupASet.has(code)
    );

    if (duplicated.length > 0) {
      return makeResult(
        "SKIP",
        0,
        "Cấu hình có mã DVKT thuộc cả hai nhóm.",
        {
          ...baseDetails,
          skipReason: "OVERLAPPING_CONFIG_CODES",
          duplicatedCodes: duplicated,
        }
      );
    }

    // ==================================================
    // 3. TRUY VẤN XML3 CỦA ĐÚNG HỒ SƠ
    // ==================================================

    const allCodes = Array.from(
      new Set([
        ...groupACodes,
        ...groupBCodes,
      ])
    );

    const query = await runtime.client.query<EventRow>(
      `
      SELECT
        mc.treatment_group,
        me.item_code,
        me.item_name

      FROM core.medical_cases mc

      LEFT JOIN core.medical_events me
        ON me.medical_case_id = mc.id
       AND UPPER(TRIM(me.source_type)) = 'XML3'
       AND UPPER(TRIM(me.item_code)) =
           ANY($2::text[])

      WHERE mc.id = $1

      ORDER BY
        me.item_code,
        me.item_name
      `,
      [caseId, allCodes]
    );

    if (query.rows.length === 0) {
      return makeResult(
        "SKIP",
        0,
        "Không tìm thấy hồ sơ trong database.",
        {
          ...baseDetails,
          skipReason: "CASE_NOT_FOUND",
        }
      );
    }

    const databaseGroup = normalize(
      query.rows[0].treatment_group
    );

    if (databaseGroup !== "GENERAL") {
      return makeResult(
        "SKIP",
        0,
        "Hồ sơ không thuộc nhóm GENERAL.",
        {
          ...baseDetails,
          skipReason: "NOT_GENERAL",
          databaseGroup,
        }
      );
    }

    // ==================================================
    // 4. PHÂN LOẠI HAI NHÓM DVKT
    // ==================================================

    const serviceA = matchServices(
      query.rows,
      groupASet
    );

    const serviceB = matchServices(
      query.rows,
      groupBSet
    );

    const matchedDetails = {
      ...baseDetails,
      matchedGroupA: serviceA,
      matchedGroupB: serviceB,
    };

    // ==================================================
    // 5. KHÔNG CÓ ĐỦ HAI NHÓM => PASS
    // ==================================================

    if (
      serviceA.length === 0 ||
      serviceB.length === 0
    ) {
      return makeResult(
        "PASS",
        0,
        "Không phát hiện đồng thời hai nhóm X-quang ngực cần rà soát.",
        matchedDetails
      );
    }

    // ==================================================
    // 6. CÓ ĐỦ HAI NHÓM => CẢNH BÁO
    // ==================================================

    const violations = [];

    for (const a of serviceA) {
      for (const b of serviceB) {
        const displayMessage =
          `Không thanh toán đồng thời hai nhóm DVKT: ` +
          `${a.name} (${a.code}) ` +
          `và ${b.name} (${b.code}). ` +
          `Hai dịch vụ cùng xuất hiện trong một hồ sơ; ` +
          `cần rà soát điều kiện thanh toán BHYT.`;

        violations.push({
          type: "SERVICE_CHEST_XRAY_EXCLUSION",

          serviceACode: a.code,
          serviceAName: a.name,

          serviceBCode: b.code,
          serviceBName: b.name,

          message:
            "Phát hiện đồng thời X-quang ngực thẳng và X-quang ngực nghiêng/chếch.",

          displayMessage,
        });
      }
    }

    return makeResult(
      "FAIL",
      violations.length,
      `Phát hiện ${violations.length} cặp DVKT X-quang ngực cần rà soát.`,
      {
        ...matchedDetails,
        violations,
      }
    );
  },
};
