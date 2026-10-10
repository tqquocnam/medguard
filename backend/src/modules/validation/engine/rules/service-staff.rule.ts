import type {
  RuleValidator,
} from "../rule.types.js";


interface ServiceStaffRuleRow {
  service_code:
    string;

  staff_code:
    string;

  activity_type:
    string;

  allowed:
    boolean;
}


function normalize(
  value:
    unknown
) {
  return String(
    value ??
    ""
  )
    .trim()
    .toUpperCase();
}


function splitCodes(
  value:
    unknown
) {
  const text =
    String(
      value ??
      ""
    ).trim();


  if (
    !text
  ) {
    return [];
  }


  return [
    ...new Set(
      text
        .split(
          /[;,|]+/
        )
        .map(
          normalize
        )
        .filter(
          Boolean
        )
    ),
  ];
}


function getStaffCodes(
  event:
    any,

  activityType:
    string
) {
  const raw =
    event.raw_data ??
    {};


  switch (
    activityType
  ) {
    case "CONGKHAM":
      return splitCodes(
        raw.MA_BAC_SI ??
        event.doctor_code
      );


    case "THUCHIEN_CDHA":
    case "THUCHIEN_PTTT":
    case "THUCHIEN_XN":
      return splitCodes(
        raw.NGUOI_THUC_HIEN
      );


    case "KETQUA_CDHA":
    case "KETQUAXN":
      return splitCodes(
        raw.MA_BS_DOC_KQ
      );


    default:
      return [];
  }
}


function getActivityLabel(
  activityType:
    string
) {
  switch (
    activityType
  ) {
    case "CONGKHAM":
      return "Công khám";


    case "THUCHIEN_CDHA":
      return "Thực hiện CĐHA";


    case "KETQUA_CDHA":
      return "Đọc/Kết quả CĐHA";


    case "THUCHIEN_PTTT":
      return "Thực hiện thủ thuật/Phẫu thuật";


    case "THUCHIEN_XN":
      return "Thực hiện xét nghiệm";


    case "KETQUAXN":
      return "Đọc/Kết quả xét nghiệm";


    default:
      return activityType;
  }
}


function isLabActivity(
  activityType:
    string
) {
  return (
    activityType ===
      "THUCHIEN_XN" ||
    activityType ===
      "KETQUAXN"
  );
}


function getApplicableTypes(
  event:
    any,

  configuredTypes:
    string[]
) {
  const eventType =
    normalize(
      event.event_type
    );


  if (
    eventType ===
    "LAB"
  ) {
    return configuredTypes.filter(
      (
        activityType
      ) =>
        isLabActivity(
          activityType
        )
    );
  }


  return configuredTypes.filter(
    (
      activityType
    ) =>
      !isLabActivity(
        activityType
      )
  );
}


export const serviceStaffRule:
  RuleValidator = {

  async evaluate(
    context,
    rule,
    runtime
  ) {
    const {
      client,
    } =
      runtime;


    const events =
      context.events.filter(
        (
          event
        ) => {
          const sourceType =
            normalize(
              event.source_type
            );


          const eventType =
            normalize(
              event.event_type
            );


          const itemCode =
            normalize(
              event.item_code
            );


          if (
            !itemCode
          ) {
            return false;
          }


          return (
            sourceType ===
              "XML3" ||
            eventType ===
              "SERVICE" ||
            eventType ===
              "LAB"
          );
        }
      );


    if (
      events.length ===
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
          "Hồ sơ không có DVKT cần kiểm tra nhân viên.",

        details: {
          violations:
            [],
        },
      };
    }


    const serviceCodes =
      [
        ...new Set(
          events
            .map(
              (
                event
              ) =>
                normalize(
                  event.item_code
                )
            )
            .filter(
              Boolean
            )
        ),
      ];


    const configResult =
      await client.query<
        ServiceStaffRuleRow
      >(
        `
        SELECT
          service_code,
          staff_code,
          activity_type,
          allowed

        FROM
          catalog.service_staff_rules

        WHERE
          active = true

          AND UPPER(
            TRIM(
              service_code
            )
          ) = ANY($1::varchar[])
        `,
        [
          serviceCodes,
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
          "PASS",

        severity:
          rule.severity,

        issueCount:
          0,

        message:
          "Không có cấu hình DVKT - Nhân viên áp dụng cho hồ sơ.",

        details: {
          violations:
            [],
        },
      };
    }


    const grouped =
      new Map<
        string,
        ServiceStaffRuleRow[]
      >();


    for (
      const config
      of configs
    ) {
      const serviceCode =
        normalize(
          config.service_code
        );


      const activityType =
        normalize(
          config.activity_type
        );


      const key =
        `${serviceCode}::${activityType}`;


      const current =
        grouped.get(
          key
        ) ??
        [];


      current.push(
        config
      );


      grouped.set(
        key,
        current
      );
    }


    const violations:
      Record<
        string,
        unknown
      >[] =
      [];


    const seen =
      new Set<
        string
      >();


    for (
      const event
      of events
    ) {
      const serviceCode =
        normalize(
          event.item_code
        );


      if (
        !serviceCode
      ) {
        continue;
      }


      const serviceName =
        String(
          event.item_name ??
          ""
        ).trim();


      const eventType =
        normalize(
          event.event_type
        );


      const configuredTypes =
        [
          ...new Set(
            configs
              .filter(
                (
                  item
                ) =>
                  normalize(
                    item.service_code
                  ) ===
                  serviceCode
              )
              .map(
                (
                  item
                ) =>
                  normalize(
                    item.activity_type
                  )
              )
              .filter(
                Boolean
              )
          ),
        ];


      if (
        configuredTypes.length ===
        0
      ) {
        continue;
      }


      const applicableTypes =
        getApplicableTypes(
          event,
          configuredTypes
        );


      if (
        applicableTypes.length ===
        0
      ) {
        continue;
      }


      for (
        const activityType
        of applicableTypes
      ) {
        const actualCodes =
          getStaffCodes(
            event,
            activityType
          );


        if (
          actualCodes.length ===
          0
        ) {
          continue;
        }


        const ruleKey =
          `${serviceCode}::${activityType}`;


        const rules =
          grouped.get(
            ruleKey
          ) ??
          [];


        if (
          rules.length ===
          0
        ) {
          continue;
        }


        const explicitlyDenied =
          new Set(
            rules
              .filter(
                (
                  item
                ) =>
                  item.allowed ===
                  false
              )
              .map(
                (
                  item
                ) =>
                  normalize(
                    item.staff_code
                  )
              )
          );


        const explicitlyAllowed =
          new Set(
            rules
              .filter(
                (
                  item
                ) =>
                  item.allowed !==
                  false
              )
              .map(
                (
                  item
                ) =>
                  normalize(
                    item.staff_code
                  )
              )
          );


        for (
          const staffCode
          of actualCodes
        ) {
          let reason:
            string |
            null =
            null;


          if (
            explicitlyDenied.has(
              staffCode
            )
          ) {
            reason =
              "DENIED";
          } else if (
            !explicitlyAllowed.has(
              staffCode
            )
          ) {
            reason =
              "NOT_CONFIGURED";
          }


          if (
            !reason
          ) {
            continue;
          }


          const violationKey =
            [
              String(
                event.id ??
                ""
              ),

              serviceCode,

              activityType,

              staffCode,
            ].join(
              "::"
            );


          if (
            seen.has(
              violationKey
            )
          ) {
            continue;
          }


          seen.add(
            violationKey
          );


          const activityLabel =
            getActivityLabel(
              activityType
            );


          const displayMessage =
            `${staffCode} không được phép ` +
            `${activityLabel} cho DVKT ` +
            `${serviceName || serviceCode}` +
            `${serviceName ? ` (${serviceCode})` : ""}.`;


          violations.push({
            type:
              "SERVICE_STAFF_NOT_ALLOWED",

            reason,

            eventId:
              event.id,

            eventType,

            sourceType:
              normalize(
                event.source_type
              ),

            serviceCode,

            serviceName,

            activityType,

            activityLabel,

            staffCode,

            displayMessage,

            message:
              displayMessage,
          });
        }
      }
    }


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
          `Phát hiện ${violations.length} trường hợp bác sĩ/nhân viên không được phép thực hiện DVKT.`,

        details: {
          violations,
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

      issueCount:
        0,

      message:
        "Bác sĩ/nhân viên thực hiện DVKT phù hợp cấu hình.",

      details: {
        violations:
          [],
      },
    };
  },
};