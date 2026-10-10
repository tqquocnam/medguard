import type {
  RuleValidator,
} from "../rule.types.js";


interface ServiceIcdConfig {
  service_code: string;
  icd_code: string;
  match_type: string;
}


function normalizeIcd(
  value: unknown
): string {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}


function collectValuesByKeys(
  data: unknown,
  keys: string[],
  result: string[] = []
): string[] {
  if (
    data === null ||
    data === undefined ||
    typeof data !== "object"
  ) {
    return result;
  }


  const normalizedKeys =
    keys.map(
      (key) =>
        key.toUpperCase()
    );


  for (
    const [key, value]
    of Object.entries(
      data as Record<string, unknown>
    )
  ) {
    if (
      normalizedKeys.includes(
        key.toUpperCase()
      )
    ) {
      if (
        value !== null &&
        value !== undefined &&
        typeof value !== "object"
      ) {
        const text =
          String(value).trim();

        if (text) {
          result.push(text);
        }
      }
    }


    if (
      value &&
      typeof value === "object"
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
  const result =
    values.flatMap(
      (value) =>
        String(value)
          .split(/[;,|]/)
          .map(
            (item) =>
              normalizeIcd(item)
          )
          .filter(Boolean)
    );


  return Array.from(
    new Set(result)
  );
}


function matchIcd(
  patientIcd: string,
  configuredIcd: string,
  matchType: string
): boolean {
  const source =
    normalizeIcd(patientIcd);

  const target =
    normalizeIcd(configuredIcd);


  if (
    !source ||
    !target
  ) {
    return false;
  }


  switch (
    String(matchType)
      .toUpperCase()
  ) {
    case "EXACT":
      return source === target;


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


export const serviceIcdRule:
  RuleValidator = {

  async evaluate(
    context,
    rule,
    runtime
  ) {
    const client =
      runtime.client;


    // ========================================
    // 1. XML1
    // ========================================

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

        issueCount: 1,

        message:
          "Không có XML1 để kiểm tra ICD của DVKT.",

        details: {
          xml:
            "XML1",
        },
      };
    }


    // ========================================
    // 2. Lấy ICD chính + ICD kèm theo
    // ========================================

    const rawIcdValues =
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
        rawIcdValues
      );


    if (
      patientIcds.length === 0
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

        issueCount: 1,

        message:
          "Hồ sơ không có mã ICD để kiểm tra DVKT.",

        details: {
          xml:
            "XML1",

          fields: [
            "MA_BENH_CHINH",
            "MA_BENH_KT",
          ],
        },
      };
    }


    // ========================================
    // 3. Lấy DVKT XML3
    // ========================================

    const services =
      context.events.filter(
        (event) => {
          const sourceType =
            String(
              event.source_type ?? ""
            ).toUpperCase();


          const eventType =
            String(
              event.event_type ?? ""
            ).toUpperCase();


          const itemCode =
            String(
              event.item_code ?? ""
            ).trim();


          if (!itemCode) {
            return false;
          }


          return (
            sourceType === "XML3" ||
            eventType === "SERVICE" ||
            eventType === "LAB"
          );
        }
      );


    if (
      services.length === 0
    ) {
      return {
        ruleId:
          rule.id,

        ruleCode:
          rule.code,

        status:
          "PASS",

        severity:
          rule.severity,

        issueCount: 0,

        message:
          "Hồ sơ không có DVKT cần kiểm tra ICD.",

        details: {
          serviceCount: 0,

          patientIcds,
        },
      };
    }


    const serviceCodes =
      Array.from(
        new Set(
          services
            .map(
              (event) =>
                String(
                  event.item_code ?? ""
                ).trim()
            )
            .filter(Boolean)
        )
      );


    // ========================================
    // 4. Lấy cấu hình
    // ========================================

    const configResult =
      await client.query<ServiceIcdConfig>(
        `
        SELECT
          service_code,
          icd_code,
          match_type

        FROM catalog.service_icd_rules

        WHERE
          active = true

          AND service_code =
              ANY($1::varchar[])

        ORDER BY
          service_code,
          icd_code
        `,
        [
          serviceCodes,
        ]
      );


    const configs =
      configResult.rows;


    // Không có DVKT nào được cấu hình
    // => rule không áp dụng.
    if (
      configs.length === 0
    ) {
      return {
        ruleId:
          rule.id,

        ruleCode:
          rule.code,

        status:
          "PASS",

        severity:
          rule.severity,

        issueCount: 0,

        message:
          "Không có DVKT thuộc danh mục DVKT - ICD.",

        details: {
          patientIcds,

          configuredServices: 0,
        },
      };
    }


    // ========================================
    // 5. Gom cấu hình theo mã DVKT
    // ========================================

    const configMap =
      new Map<
        string,
        ServiceIcdConfig[]
      >();


    for (
      const config
      of configs
    ) {
      const list =
        configMap.get(
          config.service_code
        ) ?? [];


      list.push(config);


      configMap.set(
        config.service_code,
        list
      );
    }


    const violations:
      Record<string, unknown>[] =
      [];


    const passedServices:
      Record<string, unknown>[] =
      [];


    const checkedEventIds =
      new Set<string>();


    // ========================================
    // 6. Kiểm tra từng DVKT
    // ========================================

    for (
      const service
      of services
    ) {
      const serviceCode =
        String(
          service.item_code ?? ""
        ).trim();


      const allowedIcds =
        configMap.get(
          serviceCode
        );


      // DVKT không có cấu hình
      // => bỏ qua.
      if (
        !allowedIcds ||
        allowedIcds.length === 0
      ) {
        continue;
      }


      const eventId =
        String(
          service.id ?? ""
        );


      if (
        eventId &&
        checkedEventIds.has(
          eventId
        )
      ) {
        continue;
      }


      if (eventId) {
        checkedEventIds.add(
          eventId
        );
      }


      let matched:
        {
          patientIcd: string;
          config: ServiceIcdConfig;
        }
        | null =
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


        if (matched) {
          break;
        }
      }


      if (matched) {
        passedServices.push({
          eventId:
            service.id,

          serviceCode,

          serviceName:
            service.item_name,

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
          "SERVICE_ICD_MISMATCH",

        eventId:
          service.id,

        serviceCode,

        serviceName:
          service.item_name,

        patientIcds,

        allowedIcds:
          allowedIcds.map(
            (config) => ({
              icdCode:
                config.icd_code,

              matchType:
                config.match_type,
            })
          ),
      });
    }


    // ========================================
    // 7. FAIL
    // ========================================

    if (
      violations.length > 0
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
          `Phát hiện ${violations.length} DVKT không phù hợp mã ICD của hồ sơ.`,

        details: {
          patientIcds,

          checkedCount:
            passedServices.length +
            violations.length,

          passedServices,

          violations,
        },
      };
    }


    // ========================================
    // 8. PASS
    // ========================================

    return {
      ruleId:
        rule.id,

      ruleCode:
        rule.code,

      status:
        "PASS",

      severity:
        rule.severity,

      issueCount: 0,

      message:
        `Đã kiểm tra ${passedServices.length} DVKT theo ICD, không phát hiện lỗi.`,

      details: {
        patientIcds,

        checkedCount:
          passedServices.length,

        passedServices,
      },
    };
  },
};