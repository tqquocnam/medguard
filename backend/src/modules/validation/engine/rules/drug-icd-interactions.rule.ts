import type {
  RuleValidator,
} from "../rule.types.js";

export function ingredientKey(
  value: unknown
): string {
  return String(value ?? "")
    .normalize("NFC")
    .toLowerCase()
    .trim()
    .replace(/\s*\+\s*/g, "+")
    .replace(/\s+/g, " ");
}

export function icdMatches(
  patient: string,
  configured: string,
  mode: string
): boolean {
  const a = patient.trim().toUpperCase();
  const b = configured.trim().toUpperCase();

  return (
    a === b ||
    (
      mode === "PREFIX" &&
      a.startsWith(
        b.endsWith(".") ? b : b + "."
      )
    )
  );
}

function collectIcds(
  value: unknown,
  output = new Set<string>()
): Set<string> {
  if (!value || typeof value !== "object") {
    return output;
  }

  for (
    const [key, child]
    of Object.entries(value)
  ) {
    if (
      [
        "MA_BENH_CHINH",
        "MA_BENH_KT",
        "MA_BENH_KEM_THEO",
        "MA_BENH",
      ].includes(key)
    ) {
      String(child ?? "")
        .split(/[;,|\s]+/)
        .filter(Boolean)
        .forEach(code => {
          output.add(code.toUpperCase());
        });
    } else if (
      child &&
      typeof child === "object"
    ) {
      collectIcds(child, output);
    }
  }

  return output;
}

export const drugIcdInteractionsRule:
  RuleValidator = {
  async evaluate(
    context,
    rule,
    runtime
  ) {
    const result = (
      status: "PASS" | "FAIL" | "SKIP",
      message: string,
      violations: any[] = []
    ) => ({
      ruleId: rule.id,
      ruleCode: rule.code,
      status,
      severity: rule.severity,
      issueCount: violations.length,
      message,
      details: {
        violations,
      },
    });

    if (!context.xml1) {
      return result(
        "SKIP",
        "Thiếu XML1 để đối chiếu tương tác thuốc - ICD."
      );
    }

    const icds = [
      ...collectIcds(context.xml1),
    ];

    if (!icds.length) {
      return result(
        "SKIP",
        "Hồ sơ chưa có ICD để đối chiếu tương tác thuốc."
      );
    }

    const drugs = context.events.filter(
      event =>
        (
          String(
            event.source_type
          ).toUpperCase() === "XML2" ||
          String(
            event.event_type
          ).toUpperCase() === "DRUG"
        ) &&
        String(
          event.item_code ||
          event.raw_data?.MA_THUOC ||
          ""
        ).trim()
    );

    if (!drugs.length) {
      return result(
        "SKIP",
        "Không có thuốc để kiểm tra tương tác ICD."
      );
    }

    const codeOf = (event: any) =>
      String(
        event.item_code ||
        event.raw_data?.MA_THUOC ||
        ""
      )
        .trim()
        .toLowerCase();

    const codes = [
      ...new Set(drugs.map(codeOf)),
    ];

    const {
      rows: mappings,
    } = await runtime.client.query(
      `
      SELECT
        drug_code,
        active_ingredient
      FROM catalog.drug_active_ingredients
      WHERE active = TRUE
        AND lower(btrim(drug_code))
          = ANY($1::text[])

      UNION

      SELECT
        code AS drug_code,
        active_ingredient
      FROM catalog.drugs
      WHERE active = TRUE
        AND lower(btrim(code))
          = ANY($1::text[])
      `,
      [codes]
    );

    const byCode =
      new Map<string, Set<string>>();

    for (const row of mappings) {
      const code = String(
        row.drug_code
      )
        .trim()
        .toLowerCase();

      const key = ingredientKey(
        row.active_ingredient
      );

      if (key) {
        byCode.set(
          code,
          new Set([
            ...(byCode.get(code) ?? []),
            key,
          ])
        );
      }
    }

    if (!byCode.size) {
      return result(
        "SKIP",
        "Chưa có ánh xạ hoạt chất cho các thuốc trong hồ sơ."
      );
    }

    const {
      rows: configs,
    } = await runtime.client.query(
      `
      SELECT
        id,
        active_ingredient,
        icd_code,
        icd_name,
        match_type,
        note
      FROM catalog.drug_icd_interactions
      WHERE active = TRUE
      ORDER BY id
      `
    );

    if (!configs.length) {
      return result(
        "SKIP",
        "Chưa cấu hình tương tác thuốc - ICD."
      );
    }

    const violations: any[] = [];

    for (const drug of drugs) {
      const ingredients = byCode.get(
        codeOf(drug)
      );

      if (!ingredients) continue;

      for (const config of configs) {
        // Khớp chính xác hoạt chất hoặc
        // tổ hợp hoạt chất đã khai báo.
        if (
          !ingredients.has(
            ingredientKey(
              config.active_ingredient
            )
          )
        ) {
          continue;
        }

        const matches = icds.filter(
          icd =>
            icdMatches(
              icd,
              config.icd_code,
              config.match_type
            )
        );

        if (!matches.length) continue;

        const drugName =
          drug.item_name ||
          drug.raw_data?.TEN_THUOC ||
          codeOf(drug);

        violations.push({
          eventId: drug.id,
          drugCode: codeOf(drug),
          drugName,

          activeIngredient:
            config.active_ingredient,

          icdCodes: matches,
          icdName: config.icd_name,
          note: config.note,

          orderTime:
            drug.raw_data?.NGAY_YL,

          message:
            `${drugName} ` +
            `[${config.active_ingredient}] ` +
            `gặp ICD ${matches.join(", ")}` +
            (
              config.icd_name
                ? ` (${config.icd_name})`
                : ""
            ) +
            `: ${config.note}`,
        });
      }
    }

    return result(
      violations.length ? "FAIL" : "PASS",

      violations.length
        ? `Phát hiện ${violations.length} cảnh báo tương tác thuốc - ICD theo cấu hình.`
        : "Không phát hiện tương tác thuốc - ICD trong các hoạt chất đã đối chiếu.",

      violations
    );
  },
};