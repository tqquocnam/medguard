import type {
  RuleValidator,
} from "../rule.types.js";


interface DrugIcdConfig {
  drug_code: string;
  icd_code: string;
  match_type: string;
}


// ======================================================
// HELPERS
// ======================================================

function normalizeText(
  value: unknown
): string {
  return String(
    value ??
    ""
  ).trim();
}


function normalizeCode(
  value: unknown
): string {
  return normalizeText(
    value
  ).toLowerCase();
}


function normalizeIcd(
  value: unknown
): string {
  return String(
    value ??
    ""
  )
    .trim()
    .toUpperCase()
    .replace(
      /\s+/g,
      ""
    );
}


function collectValuesByKeys(
  data: unknown,
  keys: string[],
  result: string[] = []
): string[] {

  if (
    data === null ||
    data === undefined ||
    typeof data !==
      "object"
  ) {
    return result;
  }


  const normalizedKeys =
    keys.map(
      (
        key
      ) =>
        key.toUpperCase()
    );


  for (
    const [
      key,
      value,
    ]
    of Object.entries(
      data as Record<
        string,
        unknown
      >
    )
  ) {

    if (
      normalizedKeys.includes(
        key.toUpperCase()
      )
    ) {

      if (
        value !==
          null &&
        value !==
          undefined &&
        typeof value !==
          "object"
      ) {

        const text =
          String(
            value
          ).trim();


        if (
          text
        ) {
          result.push(
            text
          );
        }
      }
    }


    if (
      value &&
      typeof value ===
        "object"
    ) {

      collectValuesByKeys(
        value,
        normalizedKeys,
        result
      );
    }
  }


  return result;
}


function splitIcdValues(
  values: string[]
): string[] {

  return Array.from(
    new Set(
      values.flatMap(
        (
          value
        ) =>
          String(
            value
          )
            .split(
              /[;,|]/
            )
            .map(
              (
                item
              ) =>
                normalizeIcd(
                  item
                )
            )
            .filter(
              Boolean
            )
      )
    )
  );
}


function matchIcd(
  patientIcd: string,
  configuredIcd: string,
  matchType: string
): boolean {

  const source =
    normalizeIcd(
      patientIcd
    );


  const target =
    normalizeIcd(
      configuredIcd
    );


  if (
    !source ||
    !target
  ) {
    return false;
  }


  switch (
    String(
      matchType
    ).toUpperCase()
  ) {

    case "EXACT":
      return (
        source ===
        target
      );


    case "CONTAINS":
      return source.includes(
        target
      );


    case "PREFIX":
    default:
      return source.startsWith(
        target
      );
  }
}


function getDrugCode(
  event: any
): string {

  const raw =
    event?.raw_data ??
    {};


  return (
    normalizeText(
      event?.item_code
    ) ||
    normalizeText(
      raw?.MA_THUOC
    )
  );
}


function getDrugName(
  event: any
): string {

  const raw =
    event?.raw_data ??
    {};


  return (
    normalizeText(
      event?.item_name
    ) ||
    normalizeText(
      raw?.TEN_THUOC
    )
  );
}


// ======================================================
// DRUG - ICD
//
// Trách nhiệm:
//
// DRUG_EXISTS:
// - thuốc không tồn tại
// - thuốc inactive
//
// DRUG_ICD:
// - chỉ kiểm tra thuốc tồn tại + active
// - chỉ kiểm tra thuốc đã cấu hình drug_icd_rules
//
// Như vậy:
// thuốc chưa có trong catalog.drugs
// => DRUG_EXISTS báo
// => DRUG_ICD bỏ qua
//
// ======================================================

export const drugIcdRule:
  RuleValidator = {

  async evaluate(
    context,
    rule,
    runtime
  ) {

    const client =
      runtime.client;


    // ==================================================
    // 1. PHẢI CÓ XML1
    // ==================================================

    if (
      !context.xml1
    ) {

      return {
        ruleId:
          rule.id,

        ruleCode:
          rule.code,

        status:
          "FAIL",

        severity:
          rule.severity,

        issueCount:
          1,

        message:
          "Không có XML1 để kiểm tra Thuốc - ICD.",

        details: {
          xml:
            "XML1",
        },
      };
    }


    // ==================================================
    // 2. ICD CỦA HỒ SƠ
    // ==================================================

    const rawIcds =
      collectValuesByKeys(
        context.xml1,
        [
          "MA_BENH_CHINH",
          "MA_BENH_KT",
          "MA_BENH_KEM_THEO",
          "MA_BENH",
        ]
      );


    const patientIcds =
      splitIcdValues(
        rawIcds
      );


    if (
      patientIcds.length ===
      0
    ) {

      return {
        ruleId:
          rule.id,

        ruleCode:
          rule.code,

        status:
          "FAIL",

        severity:
          rule.severity,

        issueCount:
          1,

        message:
          "Hồ sơ không có ICD để kiểm tra thuốc.",

        details: {
          fields: [
            "MA_BENH_CHINH",
            "MA_BENH_KT",
          ],
        },
      };
    }


    // ==================================================
    // 3. THUỐC TỪ XML2
    // ==================================================

    const drugs =
      (
        context.events ??
        []
      ).filter(
        (
          event
        ) => {

          const sourceType =
            normalizeText(
              event?.source_type
            ).toUpperCase();


          const eventType =
            normalizeText(
              event?.event_type
            ).toUpperCase();


          const drugCode =
            getDrugCode(
              event
            );


          if (
            !drugCode
          ) {
            return false;
          }


          return (
            sourceType ===
              "XML2" ||
            eventType ===
              "DRUG"
          );
        }
      );


    if (
      drugs.length ===
      0
    ) {

      return {
        ruleId:
          rule.id,

        ruleCode:
          rule.code,

        status:
          "SKIP",

        severity:
          rule.severity,

        issueCount:
          0,

        message:
          "Hồ sơ không có thuốc cần kiểm tra ICD.",

        details: {
          drugCount:
            0,

          patientIcds,

          violations:
            [],
        },
      };
    }


    // ==================================================
    // 4. UNIQUE DRUG CODES TRONG XML
    // ==================================================

    const normalizedDrugCodes =
      Array.from(
        new Set(
          drugs
            .map(
              (
                drug
              ) =>
                normalizeCode(
                  getDrugCode(
                    drug
                  )
                )
            )
            .filter(
              Boolean
            )
        )
      );


    // ==================================================
    // 5. LOAD THUỐC HỢP LỆ TỪ catalog.drugs
    //
    // Chỉ thuốc tồn tại + active.
    //
    // Thuốc missing / inactive:
    // DRUG_EXISTS chịu trách nhiệm.
    // ==================================================

    const catalogResult =
      await client.query<{
        code: string;
      }>(
        `
        SELECT
          code

        FROM
          catalog.drugs

        WHERE
          active =
          true

          AND LOWER(
            BTRIM(
              code
            )
          )
          =
          ANY(
            $1::text[]
          )
        `,
        [
          normalizedDrugCodes,
        ]
      );


    const validDrugCodes =
      new Set<string>(
        catalogResult.rows
          .map(
            (
              row
            ) =>
              normalizeCode(
                row.code
              )
          )
          .filter(
            Boolean
          )
      );


    // ==================================================
    // 6. CHỈ GIỮ THUỐC HỢP LỆ
    // ==================================================

    const eligibleDrugs =
      drugs.filter(
        (
          drug
        ) =>
          validDrugCodes.has(
            normalizeCode(
              getDrugCode(
                drug
              )
            )
          )
      );


    if (
      eligibleDrugs.length ===
      0
    ) {

      return {
        ruleId:
          rule.id,

        ruleCode:
          rule.code,

        status:
          "SKIP",

        severity:
          rule.severity,

        issueCount:
          0,

        message:
          "Không có thuốc hợp lệ trong Danh mục Thuốc để kiểm tra ICD.",

        details: {
          patientIcds,

          totalDrugEvents:
            drugs.length,

          eligibleDrugEvents:
            0,

          skippedDrugCodes:
            normalizedDrugCodes.filter(
              (
                code
              ) =>
                !validDrugCodes.has(
                  code
                )
            ),

          violations:
            [],
        },
      };
    }


    // ==================================================
    // 7. UNIQUE CODES ĐỦ ĐIỀU KIỆN
    // ==================================================

    const eligibleDrugCodes =
      Array.from(
        new Set(
          eligibleDrugs
            .map(
              (
                drug
              ) =>
                normalizeCode(
                  getDrugCode(
                    drug
                  )
                )
            )
            .filter(
              Boolean
            )
        )
      );


    // ==================================================
    // 8. ĐỌC CẤU HÌNH THUỐC - ICD
    // ==================================================

    const configResult =
      await client.query<
        DrugIcdConfig
      >(
        `
        SELECT
          drug_code,
          icd_code,
          match_type

        FROM
          catalog.drug_icd_rules

        WHERE
          active =
          true

          AND LOWER(
            BTRIM(
              drug_code
            )
          )
          =
          ANY(
            $1::text[]
          )

        ORDER BY
          drug_code,
          icd_code
        `,
        [
          eligibleDrugCodes,
        ]
      );


    const configs =
      configResult.rows;


    if (
      configs.length ===
      0
    ) {

      return {
        ruleId:
          rule.id,

        ruleCode:
          rule.code,

        status:
          "SKIP",

        severity:
          rule.severity,

        issueCount:
          0,

        message:
          "Không có thuốc hợp lệ nào được cấu hình quy luật Thuốc - ICD.",

        details: {
          patientIcds,

          totalDrugEvents:
            drugs.length,

          eligibleDrugEvents:
            eligibleDrugs.length,

          configuredDrugs:
            0,

          violations:
            [],
        },
      };
    }


    // ==================================================
    // 9. GOM CẤU HÌNH THEO MÃ THUỐC
    // ==================================================

    const configMap =
      new Map<
        string,
        DrugIcdConfig[]
      >();


    for (
      const config
      of configs
    ) {

      const key =
        normalizeCode(
          config.drug_code
        );


      if (
        !key
      ) {
        continue;
      }


      const list =
        configMap.get(
          key
        ) ??
        [];


      list.push(
        config
      );


      configMap.set(
        key,
        list
      );
    }


    const violations:
      Record<
        string,
        unknown
      >[] =
      [];


    const passedDrugs:
      Record<
        string,
        unknown
      >[] =
      [];


    const checkedEventIds =
      new Set<string>();


    // ==================================================
    // 10. KIỂM TỪNG THUỐC
    // ==================================================

    for (
      const drug
      of eligibleDrugs
    ) {

      const drugCode =
        getDrugCode(
          drug
        );


      const normalizedDrugCode =
        normalizeCode(
          drugCode
        );


      const allowedIcds =
        configMap.get(
          normalizedDrugCode
        );


      // Thuốc chưa cấu hình ICD:
      // rule không áp dụng.

      if (
        !allowedIcds ||
        allowedIcds.length ===
          0
      ) {
        continue;
      }


      const eventId =
        normalizeText(
          drug?.id
        );


      if (
        eventId &&
        checkedEventIds.has(
          eventId
        )
      ) {
        continue;
      }


      if (
        eventId
      ) {
        checkedEventIds.add(
          eventId
        );
      }


      let matched:
        {
          patientIcd: string;

          config:
            DrugIcdConfig;
        }
        |
        null =
        null;


      for (
        const patientIcd
        of patientIcds
      ) {

        for (
          const config
          of allowedIcds
        ) {

          if (
            matchIcd(
              patientIcd,
              config.icd_code,
              config.match_type
            )
          ) {

            matched = {
              patientIcd,

              config,
            };


            break;
          }
        }


        if (
          matched
        ) {
          break;
        }
      }


      if (
        matched
      ) {

        passedDrugs.push({
          eventId:
            drug?.id,

          drugCode,

          drugName:
            getDrugName(
              drug
            ),

          patientIcd:
            matched.patientIcd,

          configuredIcd:
            matched.config.icd_code,

          matchType:
            matched.config.match_type,
        });


        continue;
      }


      violations.push({
        type:
          "DRUG_ICD_MISMATCH",

        eventId:
          drug?.id,

        drugCode,

        drugName:
          getDrugName(
            drug
          ),

        patientIcds,

        allowedIcds:
          allowedIcds.map(
            (
              config
            ) => ({
              icdCode:
                config.icd_code,

              matchType:
                config.match_type,
            })
          ),
      });
    }


    const checkedCount =
      passedDrugs.length +
      violations.length;


    // ==================================================
    // 11. KHÔNG CÓ THUỐC NÀO THỰC SỰ ĐƯỢC KIỂM
    // ==================================================

    if (
      checkedCount ===
      0
    ) {

      return {
        ruleId:
          rule.id,

        ruleCode:
          rule.code,

        status:
          "SKIP",

        severity:
          rule.severity,

        issueCount:
          0,

        message:
          "Không có thuốc nào thuộc cấu hình Thuốc - ICD để kiểm tra.",

        details: {
          patientIcds,

          totalDrugEvents:
            drugs.length,

          eligibleDrugEvents:
            eligibleDrugs.length,

          checkedCount:
            0,

          passedDrugs:
            [],

          violations:
            [],
        },
      };
    }


    // ==================================================
    // 12. FAIL
    // ==================================================

    if (
      violations.length >
      0
    ) {

      return {
        ruleId:
          rule.id,

        ruleCode:
          rule.code,

        status:
          "FAIL",

        severity:
          rule.severity,

        issueCount:
          violations.length,

        message:
          `Phát hiện ${violations.length} thuốc không phù hợp ICD của hồ sơ.`,

        details: {
          patientIcds,

          totalDrugEvents:
            drugs.length,

          eligibleDrugEvents:
            eligibleDrugs.length,

          checkedCount,

          passedDrugs,

          violations,
        },
      };
    }


    // ==================================================
    // 13. PASS
    // ==================================================

    return {
      ruleId:
        rule.id,

      ruleCode:
        rule.code,

      status:
        "PASS",

      severity:
        rule.severity,

      issueCount:
        0,

      message:
        `Đã kiểm tra ${passedDrugs.length} thuốc theo ICD, không phát hiện lỗi.`,

      details: {
        patientIcds,

        totalDrugEvents:
          drugs.length,

        eligibleDrugEvents:
          eligibleDrugs.length,

        checkedCount:
          passedDrugs.length,

        passedDrugs,

        violations:
          [],
      },
    };
  },
};