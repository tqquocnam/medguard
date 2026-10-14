
import assert from "node:assert/strict";

import type { PoolClient } from "pg";

import type {
  MedicalCaseContext,
  ValidationRule,
  RuleRuntime,
} from "../rule.types.js";

import {
  drugAgeRule,
} from "./drug-age.rule.js";

import {
  serviceAgeRule,
} from "./service-age.rule.js";

type AgeCatalogRule = {
  id: string;
  code: string;
  min_age: number | null;
  max_age: number | null;
  allowed: boolean;
  note: string | null;
};

function makeRule(code: string): ValidationRule {
  return {
    id: "test-rule",
    code,
    name: code,
    validator_key: code,
    enabled: true,
    required: true,
    blocks_ok: true,
    severity: "ERROR",
    priority: 1,
    config: {},
  };
}

function makeContext(
  birthDate: string | null = "20000101",
  includeDrug = true
): MedicalCaseContext {
  return {
    medicalCase: {
      id: "test-case",
      ma_lk: "TEST-001",
      ngay_vao: "2026-10-06",
    },

    xml1: {
      THONG_TIN_BENH_NHAN: {
        NGAY_SINH: birthDate,
      },
    },

    xml2: includeDrug
      ? {
          CHITIEU_CHITIET_THUOC: {
            DSACH_CHI_TIET_THUOC: {
              CHI_TIET_THUOC: [
                {
                  STT: "1",
                  MA_THUOC: "TEST-DRUG",
                  TEN_THUOC: "Thuốc kiểm thử",
                  NGAY_YL: "202610061000",
                },
              ],
            },
          },
        }
      : undefined,

    xml3: {
      CHITIEU_CHITIET_DVKT_VTYT: {
        DSACH_CHI_TIET_DVKT: {
          CHI_TIET_DVKT: [
            {
              STT: "1",
              MA_DICH_VU: "TEST-SERVICE",
              TEN_DICH_VU: "Dịch vụ kiểm thử",
              NGAY_TH_YL: "202610061000",
            },
          ],
        },
      },
    },

    events: [],
    catalog: {},
  };
}

function makeRuntime(
  catalogRules: AgeCatalogRule[]
): RuleRuntime {
  const client = {
    query: async (
      _sql: string,
      params?: unknown[]
    ) => {
      const codes = (
        params?.[0] ?? []
      ) as string[];

      return {
        rows: catalogRules.filter(
          (rule) => codes.includes(rule.code)
        ),
      };
    },
  } as unknown as PoolClient;

  return {
    client,
    checkRunId: "test-run",
  };
}

async function runTest(
  name: string,
  actual: Promise<{ status: string }>,
  expected: string
) {
  const result = await actual;

  assert.equal(
    result.status,
    expected,
    `${name}: mong đợi ${expected}, nhận ${result.status}`
  );

  console.log(`PASS: ${name} -> ${result.status}`);
}

async function main() {
  const adult = makeContext();

  // 1. Đủ tuổi sử dụng thuốc.
  await runTest(
    "Thuốc - đủ tuổi",
    drugAgeRule.evaluate(
      adult,
      makeRule("DRUG_AGE"),
      makeRuntime([
        {
          id: "1",
          code: "TEST-DRUG",
          min_age: 18,
          max_age: 65,
          allowed: true,
          note: null,
        },
      ])
    ),
    "PASS"
  );

  // 2. Chưa đủ tuổi sử dụng DVKT.
  await runTest(
    "DVKT - chưa đủ tuổi",
    serviceAgeRule.evaluate(
      makeContext("20150101"),
      makeRule("SERVICE_AGE"),
      makeRuntime([
        {
          id: "2",
          code: "TEST-SERVICE",
          min_age: 18,
          max_age: 65,
          allowed: true,
          note: null,
        },
      ])
    ),
    "FAIL"
  );

  // 3. Thuốc bị cấm trong khoảng tuổi.
  await runTest(
    "Thuốc - thuộc khoảng tuổi bị cấm",
    drugAgeRule.evaluate(
      adult,
      makeRule("DRUG_AGE"),
      makeRuntime([
        {
          id: "3",
          code: "TEST-DRUG",
          min_age: 20,
          max_age: 30,
          allowed: false,
          note: null,
        },
      ])
    ),
    "FAIL"
  );

  // 4. Danh mục chưa cấu hình độ tuổi.
  await runTest(
    "Chưa có quy tắc độ tuổi",
    serviceAgeRule.evaluate(
      adult,
      makeRule("SERVICE_AGE"),
      makeRuntime([])
    ),
    "SKIP"
  );

  // 5. Thiếu ngày sinh bệnh nhân.
  await runTest(
    "Thiếu ngày sinh",
    drugAgeRule.evaluate(
      makeContext(null),
      makeRule("DRUG_AGE"),
      makeRuntime([
        {
          id: "4",
          code: "TEST-DRUG",
          min_age: 18,
          max_age: 65,
          allowed: true,
          note: null,
        },
      ])
    ),
    "SKIP"
  );

  // 6. Không có thuốc XML2.
  await runTest(
    "YHCT không có thuốc XML2",
    drugAgeRule.evaluate(
      makeContext("20000101", false),
      makeRule("DRUG_AGE"),
      makeRuntime([])
    ),
    "SKIP"
  );

  console.log(
    "\nHoàn tất: 6/6 tình huống đạt."
  );
}

main().catch((error) => {
  console.error("Kiểm thử thất bại:", error);
  process.exitCode = 1;
});
