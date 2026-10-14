
import assert from "node:assert/strict";

import { yhctPerformOverlapRule } from
  "../src/modules/validation/engine/rules/yhct-perform-overlap.rule.js";

type EvaluateArgs =
  Parameters<typeof yhctPerformOverlapRule.evaluate>;

type ResultStatus = "PASS" | "FAIL" | "SKIP";

type TestSession = {
  stt: string;
  code: string;
  name: string;
  staff: string;
  machine: string;
  start: string;
  end: string;
};

const ELECTRO = "08.0313.0230";
const MANUAL = "08.0432.0280";

const STAFF_A = "003330/HAUG-CCHN";
const STAFF_B = "000062/BL-GPHN";

const MACHINE_A = "MACHINE-A";
const MACHINE_B = "MACHINE-B";

const rule = {
  id: "test-yhct-overlap",
  code: "YHCT_PERFORM_OVERLAP",
  name: "Kiểm tra trùng thời gian YHCT",
  enabled: true,
  required: false,
  blocks_ok: false,
  severity: "WARNING",
  priority: 1,
  config: {
    confirmedProcedureInterval: true,
    techniques: [
      {
        code: ELECTRO,
        group: "ELECTRO",
      },
      {
        code: MANUAL,
        group: "MANUAL",
      },
    ],
  },
} as unknown as EvaluateArgs[1];

function xml3Row(session: TestSession) {
  return {
    STT: session.stt,
    MA_DICH_VU: session.code,
    TEN_DICH_VU: session.name,
    NGUOI_THUC_HIEN: session.staff,
    MA_MAY: session.machine,
    NGAY_TH_YL: session.start,
    NGAY_KQ: session.end,
  };
}

function makeContext(
  session: TestSession,
  treatmentGroup = "YHCT"
): EvaluateArgs[0] {
  return {
    medicalCase: {
      id: "11111111-1111-4111-8111-111111111111",
      ma_bn: "TEST-YHCT-A",
      treatment_group: treatmentGroup,
    },

    xml1: {
      TONG_HOP: {
        MA_LOAI_KCB: "02",
      },
    },

    xml3: {
      CHITIEU_CHITIET_DVKT_VTYT: {
        DSACH_CHI_TIET_DVKT: {
          CHI_TIET_DVKT: [
            xml3Row(session),
          ],
        },
      },
    },

    events: [],
    catalog: {},
  } as unknown as EvaluateArgs[0];
}

function makeRuntime(
  peer: TestSession | null
): EvaluateArgs[2] {
  return {
    checkRunId: "test-check-run",

    client: {
      query: async (
        sql: string,
        params: unknown[]
      ) => {
        // Xác nhận truy vấn được giới hạn YHCT.
        assert.match(
          sql,
          /mc\.treatment_group\s*=\s*'YHCT'/,
          "SQL chưa giới hạn hồ sơ YHCT"
        );

        assert.match(
          sql,
          /e\.medical_case_id\s*<>\s*\$1::uuid/,
          "SQL chưa loại hồ sơ hiện tại"
        );

        assert.equal(
          params.length,
          5,
          "Số tham số truy vấn không đúng"
        );

        if (!peer) {
          return {
            rows: [],
            rowCount: 0,
          };
        }

        return {
          rows: [
            {
              medical_case_id:
                "22222222-2222-4222-8222-222222222222",
              raw_data: xml3Row(peer),
            },
          ],
          rowCount: 1,
        };
      },
    },
  } as unknown as EvaluateArgs[2];
}

async function check(
  title: string,
  current: TestSession,
  peer: TestSession | null,
  expectedStatus: ResultStatus,
  expectedType?: string
) {
  const response =
    await yhctPerformOverlapRule.evaluate(
      makeContext(current),
      rule,
      makeRuntime(peer)
    );

  console.log(`\n${title}`);
  console.log("Kết quả:", response.status);
  console.log("Thông báo:", response.message);

  assert.equal(
    response.status,
    expectedStatus,
    `Sai trạng thái tại ${title}`
  );

  const details =
    response.details as Record<string, unknown>;

  const findings = Array.isArray(
    details?.findings
  )
    ? details.findings as
        Array<Record<string, unknown>>
    : [];

  if (expectedType) {
    assert.equal(
      findings.length,
      1,
      "Phải phát hiện đúng một cặp xung đột"
    );

    assert.equal(
      findings[0].type,
      expectedType,
      "Phân loại xung đột chưa đúng"
    );

    console.log(
      "Loại xung đột:",
      findings[0].type
    );

    console.log(
      "Số phút chồng lấn:",
      findings[0].overlapMinutes
    );
  } else {
    assert.equal(
      findings.length,
      0,
      "Không được phát sinh cảnh báo xung đột"
    );
  }

  console.log("=> TEST ĐẠT");
}

async function main() {
  console.log(
    "=== KIỂM THỬ YHCT_PERFORM_OVERLAP ==="
  );

  // =================================================
  // TEST 1
  // Hai bệnh nhân điện châm cùng giờ, cùng máy.
  // Kỳ vọng: FAIL
  // =================================================

  await check(
    "TEST 1: Điện châm cùng máy",
    {
      stt: "1",
      code: ELECTRO,
      name: "Điện châm",
      staff: STAFF_A,
      machine: MACHINE_A,
      start: "202610040900",
      end: "202610040930",
    },
    {
      stt: "2",
      code: ELECTRO,
      name: "Điện châm",
      staff: STAFF_B,
      machine: MACHINE_A,
      start: "202610040910",
      end: "202610040940",
    },
    "FAIL",
    "SAME_MACHINE_OVERLAP"
  );

  // =================================================
  // TEST 2
  // Cùng nhân viên điện châm, khác máy.
  // Theo chính sách hiện tại: PASS.
  // =================================================

  await check(
    "TEST 2: Điện châm khác máy",
    {
      stt: "3",
      code: ELECTRO,
      name: "Điện châm",
      staff: STAFF_A,
      machine: MACHINE_A,
      start: "202610040900",
      end: "202610040930",
    },
    {
      stt: "4",
      code: ELECTRO,
      name: "Điện châm",
      staff: STAFF_A,
      machine: MACHINE_B,
      start: "202610040910",
      end: "202610040940",
    },
    "PASS"
  );

  // =================================================
  // TEST 3
  // Hai bệnh nhân xoa bóp cùng giờ, cùng nhân viên.
  // Kỳ vọng: FAIL
  // =================================================

  await check(
    "TEST 3: Xoa bóp cùng nhân viên",
    {
      stt: "5",
      code: MANUAL,
      name: "Xoa bóp bấm huyệt",
      staff: STAFF_A,
      machine: "",
      start: "202610040900",
      end: "202610040930",
    },
    {
      stt: "6",
      code: MANUAL,
      name: "Xoa bóp bấm huyệt",
      staff: STAFF_A,
      machine: "",
      start: "202610040915",
      end: "202610040945",
    },
    "FAIL",
    "DIRECT_STAFF_OVERLAP"
  );

  // =================================================
  // TEST 4
  // Hai ca không chồng thời gian.
  // Kỳ vọng: PASS
  // =================================================

  await check(
    "TEST 4: Không chồng lấn",
    {
      stt: "7",
      code: ELECTRO,
      name: "Điện châm",
      staff: STAFF_A,
      machine: MACHINE_A,
      start: "202610040900",
      end: "202610040930",
    },
    {
      stt: "8",
      code: ELECTRO,
      name: "Điện châm",
      staff: STAFF_A,
      machine: MACHINE_A,
      start: "202610040930",
      end: "202610041000",
    },
    "PASS"
  );

  // =================================================
  // TEST 5
  // GENERAL không được gọi truy vấn kiểm tra YHCT.
  // =================================================

  const generalContext = makeContext(
    {
      stt: "9",
      code: ELECTRO,
      name: "Điện châm",
      staff: STAFF_A,
      machine: MACHINE_A,
      start: "202610040900",
      end: "202610040930",
    },
    "GENERAL"
  );

  let queryCalled = false;

  const generalRuntime = {
    checkRunId: "general-test",
    client: {
      query: async () => {
        queryCalled = true;
        return { rows: [] };
      },
    },
  } as unknown as EvaluateArgs[2];

  const generalResult =
    await yhctPerformOverlapRule.evaluate(
      generalContext,
      rule,
      generalRuntime
    );

  assert.equal(
    generalResult.status,
    "SKIP",
    "GENERAL phải được SKIP"
  );

  assert.equal(
    queryCalled,
    false,
    "GENERAL không được truy vấn dữ liệu YHCT"
  );

  console.log("\nTEST 5: GENERAL không áp dụng");
  console.log("Kết quả:", generalResult.status);
  console.log("=> TEST ĐẠT");

  console.log(
    "\n=== HOÀN THÀNH 5/5 BÀI KIỂM THỬ ==="
  );
}

main().catch((error: unknown) => {
  console.error(
    "\nKIỂM THỬ THẤT BẠI:",
    error
  );
  process.exitCode = 1;
});
