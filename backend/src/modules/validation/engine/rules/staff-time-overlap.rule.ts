import type {
  RuleValidator,
} from "../rule.types.js";

import {
  formatDateTime,
} from "../date-utils.js";


// ======================================================
// DATABASE ROW
// ======================================================

interface ConflictRow {
  source_event_id: string;

  conflict_event_id: string;

  conflict_case_id: string;

  conflict_ma_bn:
    string | null;

  conflict_patient_name:
    string | null;

  staff_code: string;

  source_activity: string;

  conflict_activity: string;

  source_item_code:
    string | null;

  source_item_name:
    string | null;

  conflict_item_code:
    string | null;

  conflict_item_name:
    string | null;

  source_start: Date;

  source_end: Date;

  conflict_start: Date;

  conflict_end: Date;
}


// ======================================================
// FORMAT THỜI GIAN
//
// POINT:
// 04/10/2026 08:40
//
// RANGE:
// 04/10/2026 08:40 -> 04/10/2026 08:45
// ======================================================

function formatActivityTime(
  start: Date,
  end: Date
): string {

  const startText =
    formatDateTime(
      start
    );


  const endText =
    formatDateTime(
      end
    );


  if (
    start.getTime() ===
    end.getTime()
  ) {
    return startText;
  }


  return (
    `${startText} -> ${endText}`
  );
}


// ======================================================
// RULE
// ======================================================

export const staffTimeOverlapRule:
  RuleValidator = {

  async evaluate(
    context,
    rule,
    runtime
  ) {

    const {
      client,
    } = runtime;


    const caseId =
      context.medicalCase.id;


    // ==================================================
    // CÔNG KHÁM MẶC ĐỊNH 5 PHÚT
    //
    // CHỈ áp dụng khi hồ sơ KHÔNG có CLS/XN/DVKT.
    // ==================================================

    const examWindowMinutes =
      Number(
        rule.config
          ?.examWindowMinutes ??
        5
      );


    // ==================================================
    // QUERY
    // ==================================================

    const query =
      await client.query<ConflictRow>(
        `
        WITH

        -- ===============================================
        -- 1. ĐỌC DUY NHẤT NGAY_YL
        --
        -- KHÔNG lấy:
        -- NGAY_TH_YL
        -- NGAY_KQ
        -- start_time fallback
        --
        -- Với thuốc / CLS / DVKT:
        -- thời gian dùng để check bác sĩ = NGAY_YL.
        -- ===============================================

        event_times AS (

  SELECT
    e.*,

    NULLIF(
      TRIM(
        e.raw_data ->> 'NGAY_YL'
      ),
      ''
    )
      AS raw_order_time,


    CASE

      -- =========================================
      -- YYYYMMDDHHMISS
      -- Ví dụ: 20261004084030
      -- =========================================

      WHEN
        NULLIF(
          TRIM(
            e.raw_data ->> 'NGAY_YL'
          ),
          ''
        )
        ~ '^[0-9]{14}$'

      THEN
        TO_TIMESTAMP(
          TRIM(
            e.raw_data ->> 'NGAY_YL'
          ),
          'YYYYMMDDHH24MISS'
        )::timestamp without time zone


      -- =========================================
      -- YYYYMMDDHHMI
      -- Ví dụ: 202610040840
      --
      -- Kết quả phải là:
      -- 2026-10-04 08:40:00
      --
      -- KHÔNG được chuyển thành 15:40
      -- =========================================

      WHEN
        NULLIF(
          TRIM(
            e.raw_data ->> 'NGAY_YL'
          ),
          ''
        )
        ~ '^[0-9]{12}$'

      THEN
        TO_TIMESTAMP(
          TRIM(
            e.raw_data ->> 'NGAY_YL'
          ),
          'YYYYMMDDHH24MI'
        )::timestamp without time zone


      ELSE
        NULL

    END
      AS order_time,

    CASE
      WHEN TRIM(COALESCE(e.raw_data ->> 'NGAY_TH_YL', '')) ~ '^[0-9]{14}$'
        THEN TO_TIMESTAMP(TRIM(e.raw_data ->> 'NGAY_TH_YL'), 'YYYYMMDDHH24MISS')::timestamp without time zone
      WHEN TRIM(COALESCE(e.raw_data ->> 'NGAY_TH_YL', '')) ~ '^[0-9]{12}$'
        THEN TO_TIMESTAMP(TRIM(e.raw_data ->> 'NGAY_TH_YL'), 'YYYYMMDDHH24MI')::timestamp without time zone
      ELSE NULL
    END AS execution_start,

    CASE
      WHEN TRIM(COALESCE(e.raw_data ->> 'NGAY_KQ', '')) ~ '^[0-9]{14}$'
        THEN TO_TIMESTAMP(TRIM(e.raw_data ->> 'NGAY_KQ'), 'YYYYMMDDHH24MISS')::timestamp without time zone
      WHEN TRIM(COALESCE(e.raw_data ->> 'NGAY_KQ', '')) ~ '^[0-9]{12}$'
        THEN TO_TIMESTAMP(TRIM(e.raw_data ->> 'NGAY_KQ'), 'YYYYMMDDHH24MI')::timestamp without time zone
      ELSE NULL
    END AS execution_end

  FROM
    core.medical_events e
),

        -- ===============================================
        -- 2. XÁC ĐỊNH HỒ SƠ CÓ
        -- CLS / XÉT NGHIỆM / DVKT HAY KHÔNG
        --
        -- has_cls = FALSE:
        --
        -- chỉ có công khám
        -- 07:24
        -- =>
        -- 07:24 -> 07:29
        --
        --
        -- has_cls = TRUE:
        --
        -- có chỉ định CLS
        -- công khám chỉ lấy giờ bắt đầu
        -- VD:
        -- 07:24
        -- =>
        -- POINT 07:24
        -- ===============================================

        case_flags AS (

          SELECT
            e.medical_case_id,

            BOOL_OR(

              UPPER(
                COALESCE(
                  e.event_type,
                  ''
                )
              )
              IN (
                'SERVICE',
                'LAB',
                'CLS',
                'DVKT'
              )

              AND

              LOWER(
                COALESCE(
                  e.item_name,
                  ''
                )
              )
              NOT LIKE 'khám%'

            )
              AS has_cls


          FROM
            core.medical_events e


          GROUP BY
            e.medical_case_id
        ),


        -- ===============================================
        -- 3. DANH SÁCH HOẠT ĐỘNG ĐEM SO
        -- ===============================================

        activities AS (


          -- =============================================
          -- A. CÔNG KHÁM
          --
          -- KHÔNG CÓ CLS:
          --
          --   07:24
          --   =>
          --   07:24 -> 07:29
          --
          --
          -- CÓ CLS:
          --
          --   07:24
          --   =>
          --   POINT 07:24
          -- =============================================

          SELECT
            e.id
              AS event_id,

            e.medical_case_id,


            NULLIF(
              TRIM(
                e.doctor_code
              ),
              ''
            )
              AS staff_code,


            'EXAM'
              AS activity_type,


            e.item_code,

            e.item_name,


            e.start_time
              AS activity_start,


            CASE

              -- Có CLS:
              -- chỉ lấy mốc bắt đầu khám
              WHEN
                COALESCE(
                  cf.has_cls,
                  FALSE
                ) = TRUE

              THEN
                e.start_time


              -- Không có CLS:
              -- cộng thêm 5 phút
              ELSE
                e.start_time
                +
                (
                  $2::integer *
                  INTERVAL '1 minute'
                )

            END
              AS activity_end


          FROM
            event_times e


          LEFT JOIN
            case_flags cf

            ON
              cf.medical_case_id =
              e.medical_case_id


          WHERE
            e.start_time
              IS NOT NULL


            AND

            NULLIF(
              TRIM(
                e.doctor_code
              ),
              ''
            )
              IS NOT NULL


            AND
            (
              UPPER(
                COALESCE(
                  e.event_type,
                  ''
                )
              ) = 'EXAM'


              OR


              LOWER(
                COALESCE(
                  e.item_name,
                  ''
                )
              )
              LIKE 'khám%'
            )



          UNION ALL



          -- =============================================
          -- B. THUỐC
          --
          -- CHỈ dùng NGAY_YL.
          --
          -- Không fallback start_time.
          --
          -- Ví dụ:
          --
          -- NGAY_YL = 202610040937
          --
          -- =>
          -- POINT 09:37
          -- =============================================

          SELECT
            e.id
              AS event_id,

            e.medical_case_id,


            NULLIF(
              TRIM(
                e.doctor_code
              ),
              ''
            )
              AS staff_code,


            'DRUG_ORDER'
              AS activity_type,


            e.item_code,

            e.item_name,


            e.order_time
              AS activity_start,


            e.order_time
              AS activity_end


          FROM
            event_times e


          WHERE
            UPPER(
              COALESCE(
                e.event_type,
                ''
              )
            ) = 'DRUG'


            AND

            e.order_time
              IS NOT NULL


            AND

            NULLIF(
              TRIM(
                e.doctor_code
              ),
              ''
            )
              IS NOT NULL



          UNION ALL



          -- =============================================
          -- C. Y LỆNH CLS / XÉT NGHIỆM / DVKT
          --
          -- CHỈ lấy NGAY_YL.
          --
          -- VD:
          --
          -- Siêu âm:
          --
          -- NGAY_YL    = 08:40
          -- NGAY_TH_YL = 08:45
          -- NGAY_KQ    = 09:06
          --
          -- Rule này chỉ dùng:
          --
          -- 08:40
          --
          -- KHÔNG dùng 08:45.
          -- KHÔNG dùng 09:06.
          -- =============================================

          SELECT
            e.id
              AS event_id,

            e.medical_case_id,


            -- Người ra y lệnh
            NULLIF(
              TRIM(
                e.doctor_code
              ),
              ''
            )
              AS staff_code,


            'SERVICE_ORDER'
              AS activity_type,


            e.item_code,

            e.item_name,


            e.order_time
              AS activity_start,


            e.order_time
              AS activity_end


          FROM
            event_times e


          WHERE
            UPPER(
              COALESCE(
                e.event_type,
                ''
              )
            )
            IN (
              'SERVICE',
              'LAB',
              'CLS',
              'DVKT'
            )


            -- Bắt buộc phải có NGAY_YL
            AND

            e.order_time
              IS NOT NULL


            -- Bắt buộc có bác sĩ ra y lệnh
            AND

            NULLIF(
              TRIM(
                e.doctor_code
              ),
              ''
            )
              IS NOT NULL


            -- Không đưa công khám vào lần thứ hai
            AND NOT (
              LOWER(
                COALESCE(
                  e.item_name,
                  ''
                )
              )
              LIKE 'khám%'
            )
          UNION ALL

          -- NHANH THU NGHIEM: chi noi soi co khoang thuc hien.
          -- Gio NGAY_TH_YL / NGAY_KQ phai gan NGUOI_THUC_HIEN.
          -- Khong fallback ve doctor_code neu thieu nguoi thuc hien.
          -- Giu nguyen SERVICE_ORDER dung NGAY_YL o phia tren.
          SELECT
            e.id AS event_id,
            e.medical_case_id,
            NULLIF(TRIM(e.raw_data ->> 'NGUOI_THUC_HIEN'), '') AS staff_code,
            'SERVICE_EXECUTION' AS activity_type,
            e.item_code,
            e.item_name,
            e.execution_start AS activity_start,
            e.execution_end AS activity_end
          FROM event_times e
          WHERE UPPER(COALESCE(e.event_type, '')) IN ('SERVICE', 'LAB', 'CLS', 'DVKT')
            AND LOWER(COALESCE(e.item_name, '')) LIKE '%nội soi%'
            AND NULLIF(TRIM(e.raw_data ->> 'NGUOI_THUC_HIEN'), '') IS NOT NULL
            AND e.execution_start IS NOT NULL
            AND e.execution_end IS NOT NULL
            AND e.execution_end > e.execution_start

          UNION ALL

          -- NHANH BO SUNG: Ket qua dien tim (NGAY_KQ) la mot thoi diem.
          -- Moc NGAY_KQ gan cho NGUOI_THUC_HIEN, khong gan cho MA_BAC_SI.
          -- Chi so sanh voi y lenh thuoc neu ma nhan vien trung nhau.
          -- Khong doi NGAY_YL, khoang noi soi hay cong kham hien co.
          SELECT
            e.id AS event_id,
            e.medical_case_id,
            NULLIF(TRIM(e.raw_data ->> 'NGUOI_THUC_HIEN'), '') AS staff_code,
            'ECG_RESULT_POINT' AS activity_type,
            e.item_code,
            e.item_name,
            e.execution_end AS activity_start,
            e.execution_end AS activity_end
          FROM event_times e
          WHERE UPPER(COALESCE(e.event_type, '')) IN ('SERVICE', 'LAB', 'CLS', 'DVKT')
            AND LOWER(COALESCE(e.item_name, '')) LIKE '%điện tim%'
            AND NULLIF(TRIM(e.raw_data ->> 'NGUOI_THUC_HIEN'), '') IS NOT NULL
            AND e.execution_end IS NOT NULL

          UNION ALL

          -- DOI CHIEU THEO ICHECK (RIENG): NGAY_KQ DIEN TIM VOI CONG KHAM
          -- Day KHONG phai thoi gian thuc hien cua bac si; nhan vien thuc hien
          -- van duoc xet o ECG_RESULT_POINT bang NGUOI_THUC_HIEN o tren.
          SELECT
            e.id AS event_id,
            e.medical_case_id,
            NULLIF(TRIM(e.doctor_code), '') AS staff_code,
            'ECG_RESULT_DOCTOR_EXAM' AS activity_type,
            e.item_code,
            e.item_name,
            e.execution_end AS activity_start,
            e.execution_end AS activity_end
          FROM event_times e
          WHERE UPPER(COALESCE(e.event_type, '')) IN ('SERVICE', 'LAB', 'CLS', 'DVKT')
            AND LOWER(COALESCE(e.item_name, '')) LIKE '%điện tim%'
            AND NULLIF(TRIM(e.doctor_code), '') IS NOT NULL
            AND e.execution_end IS NOT NULL

        ),


        -- ===============================================
        -- 4. HOẠT ĐỘNG HỒ SƠ A
        -- ===============================================

        source_activity AS (

          SELECT
            *

          FROM
            activities

          WHERE
            medical_case_id =
            $1::uuid
        ),


        -- ===============================================
        -- 5. HOẠT ĐỘNG CÁC HỒ SƠ KHÁC
        -- ===============================================

        target_activity AS (

          SELECT
            *

          FROM
            activities

          WHERE
            medical_case_id <>
            $1::uuid
        ),


        -- ===============================================
        -- 6. TÌM TẤT CẢ CẶP TRÙNG
        --
        -- Cùng bác sĩ / nhân viên:
        -- staff_code giống nhau.
        --
        -- Khác hồ sơ.
        -- ===============================================

        conflict_pairs AS (

          SELECT
            a.event_id
              AS source_event_id,

            b.event_id
              AS conflict_event_id,


            b.medical_case_id
              AS conflict_case_id,


            mc.ma_bn
              AS conflict_ma_bn,


            mc.ho_ten
              AS conflict_patient_name,


            mc.ngay_vao
              AS conflict_case_start,


            a.staff_code,


            a.activity_type
              AS source_activity,


            b.activity_type
              AS conflict_activity,


            a.item_code
              AS source_item_code,


            a.item_name
              AS source_item_name,


            b.item_code
              AS conflict_item_code,


            b.item_name
              AS conflict_item_name,


            a.activity_start
              AS source_start,


            a.activity_end
              AS source_end,


            b.activity_start
              AS conflict_start,


            b.activity_end
              AS conflict_end


          FROM
            source_activity a


          INNER JOIN
            target_activity b

            ON
              a.staff_code =
              b.staff_code


          INNER JOIN
            core.medical_cases mc

            ON
              mc.id =
              b.medical_case_id


          WHERE

            a.event_id <>
            b.event_id


            -- Khong doi logic hien tai, chi bo sung hai cap da duoc doi chieu iCheck.
            AND (
              (a.activity_type <> 'SERVICE_EXECUTION' AND b.activity_type <> 'SERVICE_EXECUTION')
              OR (a.activity_type = 'SERVICE_EXECUTION' AND b.activity_type IN ('EXAM', 'DRUG_ORDER'))
              OR (b.activity_type = 'SERVICE_EXECUTION' AND a.activity_type IN ('EXAM', 'DRUG_ORDER'))
              OR (a.activity_type = 'ECG_RESULT_POINT' AND b.activity_type = 'DRUG_ORDER')
              OR (b.activity_type = 'ECG_RESULT_POINT' AND a.activity_type = 'DRUG_ORDER')
              OR (a.activity_type = 'ECG_RESULT_DOCTOR_EXAM' AND b.activity_type = 'EXAM')
              OR (b.activity_type = 'ECG_RESULT_DOCTOR_EXAM' AND a.activity_type = 'EXAM')
            )

            AND

            (
              -- Nhanh goc: KHONG thay doi bat ky dieu kien nao.
              (
                a.activity_type <> 'SERVICE_EXECUTION'
                AND b.activity_type <> 'SERVICE_EXECUTION'
                AND a.activity_type <> 'ECG_RESULT_POINT'
                AND b.activity_type <> 'ECG_RESULT_POINT'
                AND a.activity_type <> 'ECG_RESULT_DOCTOR_EXAM'
                AND b.activity_type <> 'ECG_RESULT_DOCTOR_EXAM'
                AND
            (

              -- =========================================
              -- RANGE ↔ RANGE
              --
              -- VD:
              -- A 08:00 -> 08:05
              -- B 08:03 -> 08:08
              -- =========================================

              (
                a.activity_end >
                  a.activity_start

                AND

                b.activity_end >
                  b.activity_start

                AND

                a.activity_start <
                  b.activity_end

                AND

                b.activity_start <
                  a.activity_end
              )


              OR


              -- =========================================
              -- RANGE A ↔ POINT B
              --
              -- VD:
              --
              -- A khám:
              -- 08:40 -> 08:45
              --
              -- B y lệnh:
              -- 08:42
              --
              -- => TRÙNG
              -- =========================================

              (
                a.activity_end >
                  a.activity_start

                AND

                b.activity_end =
                  b.activity_start

                AND

                b.activity_start >=
                  a.activity_start

                AND

                b.activity_start <=
                  a.activity_end
              )


              OR


              -- =========================================
              -- POINT A ↔ RANGE B
              -- =========================================

              (
                a.activity_end =
                  a.activity_start

                AND

                b.activity_end >
                  b.activity_start

                AND

                a.activity_start >=
                  b.activity_start

                AND

                a.activity_start <=
                  b.activity_end
              )


              OR


              -- =========================================
              -- POINT ↔ POINT
              --
              -- Phải cùng đúng thời gian.
              -- =========================================

              (
                a.activity_end =
                  a.activity_start

                AND

                b.activity_end =
                  b.activity_start

                AND

                a.activity_start =
                  b.activity_start
              )
            )
              )
              OR
              -- Gio ket qua DIEN TIM va gio NGAY_YL THUOC trung dung phut.
              (
                a.activity_type = 'ECG_RESULT_POINT'
                AND b.activity_type = 'DRUG_ORDER'
                AND a.activity_start = b.activity_start
              )
              OR
              (
                b.activity_type = 'ECG_RESULT_POINT'
                AND a.activity_type = 'DRUG_ORDER'
                AND b.activity_start = a.activity_start
              )
              OR
              -- TUONG THICH ICHECK: NGAY_KQ cua dien tim theo MA_BAC_SI
              -- Su dung activity_end cua cong kham DA tinh tu case_flags:
              -- ho so co CLS => moc bat dau, khong CLS => khoang 5 phut.
              -- Khong so voi thuoc trong nhanh tuong thich nay.
              (
                a.activity_type = 'ECG_RESULT_DOCTOR_EXAM'
                AND b.activity_type = 'EXAM'
                AND a.activity_start BETWEEN b.activity_start AND b.activity_end
              )
              OR
              (
                b.activity_type = 'ECG_RESULT_DOCTOR_EXAM'
                AND a.activity_type = 'EXAM'
                AND b.activity_start BETWEEN a.activity_start AND a.activity_end
              )
              OR
              -- Noi soi execution voi thuoc: khoang [bat dau, ket thuc], gom diem ket thuc.
              (
                a.activity_type = 'SERVICE_EXECUTION'
                AND b.activity_type = 'DRUG_ORDER'
                AND b.activity_start BETWEEN a.activity_start AND a.activity_end
              )
              OR
              (
                b.activity_type = 'SERVICE_EXECUTION'
                AND a.activity_type = 'DRUG_ORDER'
                AND a.activity_start BETWEEN b.activity_start AND b.activity_end
              )
              OR
              -- Cong kham 5 phut CHI khi doi chieu voi noi soi.
              (
                a.activity_type = 'SERVICE_EXECUTION'
                AND b.activity_type = 'EXAM'
                AND a.activity_start < b.activity_start + ($2::integer * interval '1 minute')
                AND a.activity_end >= b.activity_start
              )
              OR
              (
                b.activity_type = 'SERVICE_EXECUTION'
                AND a.activity_type = 'EXAM'
                AND b.activity_start < a.activity_start + ($2::integer * interval '1 minute')
                AND b.activity_end >= a.activity_start
              )
            )
        )


        -- 7. Trả về TẤT CẢ các cặp xung đột A-B, A-C, A-D...
        -- Không thay đổi logic thời gian khám của bản gốc.
        -- CTE conflict_pairs đã loại những cặp không xung đột.

        SELECT DISTINCT
          cp.source_event_id,

          cp.conflict_event_id,

          cp.conflict_case_id,

          cp.conflict_ma_bn,

          cp.conflict_patient_name,

          cp.staff_code,

          cp.source_activity,

          cp.conflict_activity,

          cp.source_item_code,

          cp.source_item_name,

          cp.conflict_item_code,

          cp.conflict_item_name,

          cp.source_start,

          cp.source_end,

          cp.conflict_start,

          cp.conflict_end


        FROM
          conflict_pairs cp


        ORDER BY
          cp.source_start ASC,

          cp.conflict_start ASC,

          cp.source_event_id ASC,

          cp.conflict_event_id ASC
        `,
        [
          caseId,
          examWindowMinutes,
        ]
      );


    const conflicts =
      query.rows;


    // ==================================================
    // PASS
    // ==================================================

    if (
      conflicts.length ===
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
          "Không phát hiện trùng thời gian nhân viên giữa các hồ sơ.",

        details: {
          conflictCount:
            0,

          conflictCaseId:
            null,

          conflictPatient:
            null,

          violations:
            [],
        },
      };
    }


    // ==================================================
    // HỒ SƠ B
    // ==================================================

    const first =
      conflicts[0];


    // Các hồ sơ đối chiếu duy nhất, để modal hiển thị A với B/C/D...
    const conflictCaseMap = new Map<
      string,
      { caseId: string; maBn: string | null; hoTen: string | null }
    >();

    for (const row of conflicts) {
      if (!conflictCaseMap.has(row.conflict_case_id)) {
        conflictCaseMap.set(row.conflict_case_id, {
          caseId: row.conflict_case_id,
          maBn: row.conflict_ma_bn,
          hoTen: row.conflict_patient_name,
        });
      }
    }

    const conflictCases = Array.from(conflictCaseMap.values());

    // ==================================================
    // FORMAT DANH SÁCH LỖI
    // ==================================================

    const violations =
      conflicts.map(
        (
          row,
          index
        ) => {

          const sourceTime =
            formatActivityTime(
              row.source_start,
              row.source_end
            );


          const conflictTime =
            formatActivityTime(
              row.conflict_start,
              row.conflict_end
            );


          const sourceName =
            row.source_item_name ??
            "Hoạt động";


          const conflictName =
            row.conflict_item_name ??
            "Hoạt động";


          const patientName =
            row.conflict_patient_name ??
            "Không rõ bệnh nhân";


          // =============================================
          // FORMAT GIỐNG WEB MẪU
          //
          // 005769/ST-CCHN
          // [Siêu âm ổ bụng:
          // 04/10/2026 08:40
          // (Trùng thời gian)
          // TRẦN QUỐC THIÊN -
          // Khám Nội tổng hợp:
          // 04/10/2026 08:40]
          // =============================================

          const displayMessage =
            `${row.staff_code} ` +

            `[${sourceName}: ` +

            `${sourceTime} ` +

            `(Trùng thời gian) ` +

            `${patientName} - ` +

            `${conflictName}:` +

            `${conflictTime}]`;


          return {
            index:
              index + 1,


            sourceEventId:
              row.source_event_id,


            conflictEventId:
              row.conflict_event_id,


            sourceCaseId:
              caseId,


            conflictCaseId:
              row.conflict_case_id,


            staffCode:
              row.staff_code,


            sourceActivity:
              row.source_activity,


            conflictActivity:
              row.conflict_activity,


            sourceItemCode:
              row.source_item_code,


            sourceItemName:
              row.source_item_name,


            conflictItemCode:
              row.conflict_item_code,


            conflictItemName:
              row.conflict_item_name,


            sourceStart:
              formatDateTime(
                row.source_start
              ),


            sourceEnd:
              formatDateTime(
                row.source_end
              ),


            conflictStart:
              formatDateTime(
                row.conflict_start
              ),


            conflictEnd:
              formatDateTime(
                row.conflict_end
              ),


            conflictPatientName:
              row.conflict_patient_name,


            conflictPatientCode:
              row.conflict_ma_bn,


            conflictPatient: {

              maBn:
                row.conflict_ma_bn,


              hoTen:
                row.conflict_patient_name,
            },


            displayMessage,
          };
        }
      );


    // ==================================================
    // FAIL
    // ==================================================

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
        `Phát hiện ${violations.length} hoạt động trùng thời gian với ` +
        `${conflictCases.length} hồ sơ khác.`,

      details: {

        conflictCaseId:
          first
            .conflict_case_id,


        conflictPatient: {

          maBn:
            first
              .conflict_ma_bn,


          hoTen:
            first
              .conflict_patient_name,
        },


        conflictCount:
          violations.length,

        conflictCaseCount: conflictCases.length,
        conflictCases,

        violations,
      },
    };
  },
};