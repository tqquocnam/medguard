import type {
  RuleValidator,
} from "../rule.types";

import {
  formatDateTime,
  parseDate,
} from "../date-utils.js";


export const visitTimeRule:
  RuleValidator = {

  async evaluate(
    context,
    rule
  ) {
    const ngayVao =
      parseDate(
        context.medicalCase.ngay_vao
      );

    const ngayRa =
      parseDate(
        context.medicalCase.ngay_ra
      );


    if (!ngayVao) {
      return {
        ruleId: rule.id,
        ruleCode: rule.code,

        status: "FAIL",
        severity: rule.severity,

        message:
          "Hồ sơ thiếu hoặc sai ngày vào.",

        details: {
          field: "NGAY_VAO",
        },
      };
    }


    if (!ngayRa) {
      return {
        ruleId: rule.id,
        ruleCode: rule.code,

        status: "FAIL",
        severity: rule.severity,

        message:
          "Hồ sơ thiếu hoặc sai ngày ra.",

        details: {
          field: "NGAY_RA",
        },
      };
    }


    if (
      ngayRa.getTime() <
      ngayVao.getTime()
    ) {
      return {
        ruleId: rule.id,
        ruleCode: rule.code,

        status: "FAIL",
        severity: rule.severity,

        message:
          "Ngày ra nhỏ hơn ngày vào.",

        details: {
          ngayVao:
            formatDateTime(ngayVao),

          ngayRa:
            formatDateTime(ngayRa),
        },
      };
    }


    return {
      ruleId: rule.id,
      ruleCode: rule.code,

      status: "PASS",
      severity: rule.severity,

      message:
        "Thời gian vào/ra viện hợp lệ.",

      details: {
        ngayVao:
          formatDateTime(ngayVao),

        ngayRa:
          formatDateTime(ngayRa),
      },
    };
  },
};