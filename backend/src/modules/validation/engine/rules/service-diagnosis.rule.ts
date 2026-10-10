import type {
  RuleValidator,
} from "../rule.types.js";


// ======================================================
// CONFIG DATABASE
// ======================================================

interface ServiceDiagnosisConfig {
  service_code: string;

  diagnosis_pattern: string;

  match_type: string;
}


// ======================================================
// NORMALIZE TEXT
//
// Ví dụ:
//
// "Đánh Trống Ngực"
// =>
// "danh trong nguc"
//
// Như vậy không bị ảnh hưởng:
// - hoa/thường
// - dấu tiếng Việt
// - khoảng trắng thừa
// ======================================================

function normalizeText(
  value: unknown
): string {

  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }


  return String(
    value
  )
    .normalize(
      "NFD"
    )
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .replace(
      /đ/g,
      "d"
    )
    .replace(
      /Đ/g,
      "D"
    )
    .toLowerCase()
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}


// ======================================================
// TÌM GIÁ TRỊ THEO KEY TRONG JSON
//
// Dùng recursive vì dữ liệu XML1 có thể
// nằm ở nhiều cấp JSON.
// ======================================================

function collectValuesByKeys(
  data: unknown,

  keys: string[],

  result:
    string[] = []
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

    const upperKey =
      key.toUpperCase();


    if (
      normalizedKeys.includes(
        upperKey
      )
    ) {

      if (
        value !== null &&
        value !== undefined &&
        typeof value !==
          "object"
      ) {

        const text =
          String(
            value
          ).trim();


        if (text) {
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


// ======================================================
// MATCH CHẨN ĐOÁN
// ======================================================

function matchesDiagnosis(
  diagnosis: string,

  pattern: string,

  matchType: string
): boolean {

  const source =
    normalizeText(
      diagnosis
    );


  const target =
    normalizeText(
      pattern
    );


  if (
    !source ||
    !target
  ) {
    return false;
  }


  const type =
    String(
      matchType ||
      "CONTAINS"
    )
      .trim()
      .toUpperCase();


  switch (type) {

    // ==========================================
    // EXACT
    // ==========================================

    case "EXACT":

      return (
        source ===
        target
      );


    // ==========================================
    // STARTS_WITH
    // ==========================================

    case "STARTS_WITH":

      return source.startsWith(
        target
      );


    // ==========================================
    // REGEX
    // ==========================================

    case "REGEX":

      try {

        return new RegExp(
          pattern,
          "i"
        ).test(
          diagnosis
        );

      } catch {

        return false;
      }


    // ==========================================
    // CONTAINS
    //
    // Mặc định dùng loại này.
    // ==========================================

    case "CONTAINS":

    default:

      return source.includes(
        target
      );
  }
}


// ======================================================
// KIỂM TRA EVENT CÓ PHẢI DVKT/XML3 KHÔNG
// ======================================================

function isServiceEvent(
  event: any
): boolean {

  const sourceType =
    String(
      event.source_type ??
      ""
    )
      .trim()
      .toUpperCase();


  const eventType =
    String(
      event.event_type ??
      ""
    )
      .trim()
      .toUpperCase();


  const itemCode =
    String(
      event.item_code ??
      ""
    ).trim();


  if (!itemCode) {
    return false;
  }


  return (
    sourceType ===
      "XML3" ||

    eventType ===
      "SERVICE" ||

    eventType ===
      "LAB" ||

    eventType ===
      "CLS" ||

    eventType ===
      "DVKT"
  );
}


// ======================================================
// RULE
// ======================================================

export const serviceDiagnosisRule:
  RuleValidator = {

  async evaluate(
    context,
    rule,
    runtime
  ) {

    const client =
      runtime.client;


    const events =
      context.events ??
      [];


    // ==================================================
    // 1. LẤY DVKT CỦA HỒ SƠ TRƯỚC
    //
    // Không kiểm "thiếu chẩn đoán" ngay.
    //
    // Phải xem hồ sơ có DVKT thuộc danh mục
    // cấu hình hay không trước.
    // ==================================================

    const services =
      events.filter(
        isServiceEvent
      );


    // ==================================================
    // KHÔNG CÓ DVKT
    // => RULE KHÔNG ÁP DỤNG
    // ==================================================

    if (
      services.length ===
      0
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

        issueCount:
          0,

        message:
          "Hồ sơ không có DVKT cần kiểm tra chẩn đoán vào.",

        details: {
          serviceCount:
            0,

          configuredServiceCount:
            0,
        },
      };
    }


    // ==================================================
    // 2. DANH SÁCH MÃ DVKT
    // ==================================================

    const serviceCodes =
      Array.from(
        new Set(
          services
            .map(
              (
                event
              ) =>
                String(
                  event.item_code ??
                  ""
                ).trim()
            )
            .filter(
              Boolean
            )
        )
      );


    // ==================================================
    // 3. ĐỌC CẤU HÌNH
    // ==================================================

    const configResult =
      await client.query<
        ServiceDiagnosisConfig
      >(
        `
        SELECT
          service_code,
          diagnosis_pattern,
          match_type

        FROM
          catalog.service_diagnosis_rules

        WHERE
          active = true

          AND

          service_code =
            ANY($1::varchar[])

        ORDER BY
          service_code,
          diagnosis_pattern
        `,
        [
          serviceCodes,
        ]
      );


    const configs =
      configResult.rows;


    // ==================================================
    // KHÔNG CÓ MÃ DVKT NÀO ĐƯỢC CẤU HÌNH
    //
    // => KHÔNG ĐƯỢC BÁO:
    // "Thiếu chẩn đoán vào"
    //
    // Vì rule này chưa áp dụng cho hồ sơ.
    // ==================================================

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
          "PASS",

        severity:
          rule.severity,

        issueCount:
          0,

        message:
          "Không có DVKT thuộc danh mục DVKT - Chẩn đoán vào.",

        details: {
          serviceCount:
            services.length,

          configuredServiceCount:
            0,
        },
      };
    }


    // ==================================================
    // 4. GOM CẤU HÌNH THEO MÃ DVKT
    //
    // Ví dụ:
    //
    // 21.0014.1778:
    //
    // - đánh trống ngực
    // - hồi hộp
    // - mệt mỏi kéo dài
    // - tiền sử bệnh tim
    // - ...
    //
    // TẤT CẢ LÀ QUAN HỆ OR.
    // ==================================================

    const configMap =
      new Map<
        string,
        ServiceDiagnosisConfig[]
      >();


    for (
      const config
      of configs
    ) {

      const serviceCode =
        String(
          config.service_code
        ).trim();


      const current =
        configMap.get(
          serviceCode
        ) ??
        [];


      // ========================================
      // TRÁNH CONFIG TRÙNG
      // ========================================

      const duplicate =
        current.some(
          (
            item
          ) =>
            normalizeText(
              item.diagnosis_pattern
            ) ===
              normalizeText(
                config.diagnosis_pattern
              )

            &&

            String(
              item.match_type
            ).toUpperCase() ===
              String(
                config.match_type
              ).toUpperCase()
        );


      if (!duplicate) {

        current.push(
          config
        );
      }


      configMap.set(
        serviceCode,
        current
      );
    }


    // ==================================================
    // 5. CHỈ GIỮ CÁC DVKT THỰC SỰ CÓ CẤU HÌNH
    // ==================================================

    const configuredServices =
      services.filter(
        (
          service
        ) => {

          const code =
            String(
              service.item_code ??
              ""
            ).trim();


          const configuredRules =
            configMap.get(
              code
            );


          return (
            configuredRules !==
              undefined &&

            configuredRules.length >
              0
          );
        }
      );


    if (
      configuredServices.length ===
      0
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

        issueCount:
          0,

        message:
          "Không có DVKT thuộc danh mục DVKT - Chẩn đoán vào.",

        details: {
          serviceCount:
            services.length,

          configuredServiceCount:
            0,
        },
      };
    }


    // ==================================================
    // 6. BÂY GIỜ MỚI KIỂM TRA XML1 / CHẨN ĐOÁN
    //
    // Chỉ báo thiếu khi:
    //
    // - hồ sơ thực sự có DVKT được cấu hình
    // - nhưng không có chẩn đoán vào.
    // ==================================================

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

        issueCount:
          1,

        message:
          "Hồ sơ có DVKT cần đối chiếu nhưng không có XML1 để lấy chẩn đoán vào.",

        details: {

          xml:
            "XML1",

          configuredServices:
            configuredServices.map(
              (
                service
              ) => ({
                serviceCode:
                  service.item_code,

                serviceName:
                  service.item_name,
              })
            ),

          violations: [
            {
              type:
                "MISSING_ADMISSION_DIAGNOSIS",

              displayMessage:
                "Thiếu chẩn đoán vào để đối chiếu DVKT.",
            },
          ],
        },
      };
    }


    // ==================================================
    // LẤY CHẨN ĐOÁN VÀO
    // ==================================================

    const diagnosisValues =
      collectValuesByKeys(
        context.xml1,
        [
          "CHAN_DOAN_VAO",

          "CHAN_DOAN_VAO_VIEN",

          "CHAN_DOAN_VV",
        ]
      );


    // Loại bỏ giá trị trùng nhau.
    const uniqueDiagnosisValues =
      Array.from(
        new Set(
          diagnosisValues
            .map(
              (
                value
              ) =>
                String(
                  value
                ).trim()
            )
            .filter(
              Boolean
            )
        )
      );


    const diagnosisText =
      uniqueDiagnosisValues.join(
        "; "
      );


    // ==================================================
    // THỰC SỰ THIẾU CHẨN ĐOÁN
    // ==================================================

    if (!diagnosisText) {

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
          "Hồ sơ thiếu chẩn đoán vào để đối chiếu DVKT.",

        details: {

          xml:
            "XML1",

          field:
            "CHAN_DOAN_VAO",

          configuredServices:
            configuredServices.map(
              (
                service
              ) => ({
                serviceCode:
                  service.item_code,

                serviceName:
                  service.item_name,
              })
            ),

          violations: [
            {
              type:
                "MISSING_ADMISSION_DIAGNOSIS",

              displayMessage:
                "Thiếu chẩn đoán vào để đối chiếu DVKT.",
            },
          ],
        },
      };
    }


    // ==================================================
    // 7. KIỂM TRA TỪNG DVKT
    //
    // CỰC KỲ QUAN TRỌNG:
    //
    // rules.some(...)
    //
    // Nghĩa là:
    //
    // chỉ cần 1 chẩn đoán trong danh mục phù hợp
    // => DVKT HỢP LỆ.
    //
    // KHÔNG yêu cầu tất cả cùng đúng.
    // ==================================================

    const violations:
      Record<
        string,
        unknown
      >[] = [];


    const passedServices:
      Record<
        string,
        unknown
      >[] = [];


    const checkedEventIds =
      new Set<
        string
      >();


    for (
      const service
      of configuredServices
    ) {

      const code =
        String(
          service.item_code ??
          ""
        ).trim();


      const serviceRules =
        configMap.get(
          code
        ) ??
        [];


      // ========================================
      // TRÁNH KIỂM CÙNG EVENT HAI LẦN
      // ========================================

      const eventKey =
        service.id
          ? String(
              service.id
            )
          : [
              code,

              service.item_name ??
              "",

              service.start_time ??
              "",
            ].join(
              "|"
            );


      if (
        checkedEventIds.has(
          eventKey
        )
      ) {
        continue;
      }


      checkedEventIds.add(
        eventKey
      );


      // ========================================
      // QUAN HỆ OR
      //
      // Chỉ cần 1 RULE TRUE
      // => PASS.
      // ========================================

      const matchedRule =
        serviceRules.find(
          (
            config
          ) =>
            matchesDiagnosis(
              diagnosisText,

              config.diagnosis_pattern,

              config.match_type
            )
        );


      // ========================================
      // ĐÃ KHỚP ÍT NHẤT 1 CHẨN ĐOÁN
      // => HỢP LỆ
      // ========================================

      if (matchedRule) {

        passedServices.push({

          eventId:
            service.id,

          serviceCode:
            code,

          serviceName:
            service.item_name,

          diagnosis:
            diagnosisText,

          matchedDiagnosis:
            matchedRule
              .diagnosis_pattern,

          matchType:
            matchedRule
              .match_type,
        });


        // Quan trọng:
        // Không kiểm các diagnosis_pattern còn lại
        // để tạo lỗi nữa.
        continue;
      }


      // ========================================
      // KHÔNG CÓ BẤT KỲ PATTERN NÀO KHỚP
      //
      // Lúc này mới báo lỗi.
      // ========================================

      const allowedDiagnosis =
        serviceRules.map(
          (
            config
          ) =>
            config
              .diagnosis_pattern
        );


      violations.push({

        type:
          "SERVICE_DIAGNOSIS_MISMATCH",

        eventId:
          service.id,

        serviceCode:
          code,

        serviceName:
          service.item_name,

        diagnosis:
          diagnosisText,

        allowedDiagnosis,

        displayMessage:
          `${service.item_name ?? code}: ` +
          `Không phù hợp chẩn đoán vào`,
      });
    }


    // ==================================================
    // 8. CÓ DVKT KHÔNG PHÙ HỢP
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
          `Phát hiện ${violations.length} DVKT không phù hợp chẩn đoán vào.`,

        details: {

          diagnosis:
            diagnosisText,

          checkedCount:
            violations.length +
            passedServices.length,

          passedCount:
            passedServices.length,

          failedCount:
            violations.length,

          passedServices,

          violations,
        },
      };
    }


    // ==================================================
    // 9. PASS
    //
    // Tất cả DVKT đã cấu hình đều tìm được
    // ít nhất 1 chẩn đoán phù hợp.
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
        `Đã kiểm tra ${passedServices.length} DVKT theo chẩn đoán vào, không phát hiện lỗi.`,

      details: {

        diagnosis:
          diagnosisText,

        checkedCount:
          passedServices.length,

        passedCount:
          passedServices.length,

        failedCount:
          0,

        passedServices,

        violations:
          [],
      },
    };
  },
};