import type {
  RuleValidator,
} from "../rule.types.js"


function findValueByKey(
  data: any,
  targetKeys: string[]
): string | null {
  if (
    data === null ||
    data === undefined
  ) {
    return null;
  }


  if (
    typeof data !== "object"
  ) {
    return null;
  }


  for (
    const [
      key,
      value,
    ]
    of Object.entries(data)
  ) {
    const normalizedKey =
      key.toUpperCase();

    if (
      targetKeys.includes(
        normalizedKey
      )
    ) {
      if (
        value !== null &&
        value !== undefined &&
        String(value).trim() !== ""
      ) {
        return String(
          value
        ).trim();
      }
    }


    if (
      typeof value === "object"
    ) {
      const found =
        findValueByKey(
          value,
          targetKeys
        );

      if (found) {
        return found;
      }
    }
  }


  return null;
}


export const icdRequiredRule:
  RuleValidator = {

  async evaluate(
    context,
    rule
  ) {
    // =====================================
    // Không có XML1
    // =====================================

    if (!context.xml1) {
      return {
        ruleId:
          rule.id,

        ruleCode:
          rule.code,

        status:
          "FAIL",

        severity:
          rule.severity,

        message:
          "Hồ sơ thiếu XML1.",

        details: {
          xml:
            "XML1",
        },
      };
    }


    // =====================================
    // Tìm ICD chính
    //
    // Hỗ trợ một số tên field phổ biến
    // =====================================

    const mainIcd =
      findValueByKey(
        context.xml1,
        [
          "MA_BENH_CHINH",
          "MA_BENH",
        ]
      );


    if (!mainIcd) {
      return {
        ruleId:
          rule.id,

        ruleCode:
          rule.code,

        status:
          "FAIL",

        severity:
          rule.severity,

        message:
          "Hồ sơ thiếu mã ICD chính.",

        details: {
          xml:
            "XML1",

          field:
            "MA_BENH_CHINH",
        },
      };
    }


    return {
      ruleId:
        rule.id,

      ruleCode:
        rule.code,

      status:
        "PASS",

      severity:
        rule.severity,

      message:
        `ICD chính: ${mainIcd}`,

      details: {
        icd:
          mainIcd,
      },
    };
  },
};