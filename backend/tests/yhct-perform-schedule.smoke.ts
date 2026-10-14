
import assert from "node:assert/strict";

import { yhctPerformScheduleRule } from
  "../src/modules/validation/engine/rules/yhct-perform-schedule.rule.js";

type EvaluateArgs =
  Parameters<typeof yhctPerformScheduleRule.evaluate>;

const rule = {
  id: "test-yhct-schedule",
  code: "YHCT_PERFORM_SCHEDULE",
  severity: "WARNING",
  enabled: true,
  required: false,
  blocks_ok: false,
  priority: 1,
  config: {},
} as unknown as EvaluateArgs[1];

function makeContext(
  startTime: string,
  endTime: string
): EvaluateArgs[0] {
  return {
    medicalCase: {
      id: "test-medical-case",
      ma_bn: "TEST-YHCT",
      treatment_group: "YHCT",
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
            {
              STT: "1",
              MA_DICH_VU: "08.0313.0230",
              TEN_DICH_VU:
                "Điện châm điều trị đau do thoái hóa khớp",
              NGUOI_THUC_HIEN:
                "003330/HAUG-CCHN;003330/HAUG-CCHN",
              NGAY_TH_YL: startTime,
              NGAY_KQ: endTime,
            },
          ],
        },
      },
    },
    xml2: null,
    xml4: null,
    xml5: null,
    events: [],
    catalog: {},
  } as unknown as EvaluateArgs[0];
}

function makeRuntime(): EvaluateArgs[2] {
  const schedules = [
    {
      staff_code: "003330/HAUG-CCHN",
      staff_id: "test-staff",
      staff_name: "Nguyễn Tấn Thành",
      staff_active: true,
      has_any_schedule: true,
      schedule_id: "test-schedule",
      work_date: "2026-10-04",
      start_time: "07:00:00",
      end_time: "19:00:00",
      status: "ACTIVE",
    },
  ];

  return {
    checkRunId: "test-check-run",
    client: {
      // Giả lập phản hồi PostgreSQL.
      // Không thực hiện truy vấn thật.
      query: async () => ({
        rows: schedules,
        rowCount: schedules.length,
      }),
    },
  } as unknown as EvaluateArgs[2];
}

async function check(
  title: string,
  start: string,
  end: string,
  expectedStatus: "PASS" | "FAIL"
) {
  const result =
    await yhctPerformScheduleRule.evaluate(
      makeContext(start, end),
      rule,
      makeRuntime()
    );

  console.log(`\n${title}`);
  console.log("Kết quả:", result.status);
  console.log("Thông báo:", result.message);

  assert.equal(
    result.status,
    expectedStatus,
    `${title}: trạng thái không đúng`
  );

  console.log("=> TEST ĐẠT");
}

async function main() {
  console.log("KIỂM THỬ LỊCH THỰC HIỆN YHCT");
  console.log("Lịch giả lập: 04/10/2026, 07:00–19:00");

  // 1. Hoàn toàn trong ca trực.
  await check(
    "TEST 1: Điện châm 09:13–09:38",
    "202610040913",
    "202610040938",
    "PASS"
  );

  // 2. Bắt đầu sau giờ kết thúc ca.
  await check(
    "TEST 2: Điện châm 20:13–20:38",
    "202610042013",
    "202610042038",
    "FAIL"
  );

  // 3. Bắt đầu trước 19:00, kết thúc sau 19:00.
  // Rule hiện tại chỉ kiểm tra NGAY_TH_YL,
  // vì vậy sẽ PASS. Đây là hạn chế cần sửa.

await check(
  "TEST 3: Điện châm 18:50–19:10",
  "202610041850",
  "202610041910",
  "FAIL"
);

  console.log(
    "\nHoàn thành kiểm thử hành vi hiện tại."
  );

console.log(
  "TEST 3 đạt: Rule đã phát hiện NGAY_KQ vượt giờ trực."
);
}

main().catch((error: unknown) => {
  console.error("KIỂM THỬ THẤT BẠI:", error);
  process.exitCode = 1;
});
