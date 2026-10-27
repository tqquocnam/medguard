import {

  db,

} from "../../config/database.js";



import {

  prepareImportBatch,

  finishImportBatch,

} from "./import-batch.service.js";



import {

  normalizeXmlFile,

} from "../medical-event/event.normalizer.js";





type ParsedBhytResult = {

  facilityCode?: string;

  createdDate?: string;



  declaredTotal: number;

  actualTotal: number;



  cases: any[];

};





export type ImportProgressCallback = (

  current: number,

  total: number

) => void;





// ======================================================

// CHUYỂN NGÀY BHYT -> PostgreSQL datetime

// ======================================================



function bhytDateTime(

  value?: unknown

): string | null {



  if (

    value === undefined ||

    value === null

  ) {

    return null;

  }





  const raw =

    String(

      value

    ).trim();





  if (

    raw.length < 8

  ) {

    return null;

  }





  const year =

    raw.slice(

      0,

      4

    );



  const month =

    raw.slice(

      4,

      6

    );



  const day =

    raw.slice(

      6,

      8

    );





  const hour =

    raw.length >= 10

      ? raw.slice(

          8,

          10

        )

      : "00";





  const minute =

    raw.length >= 12

      ? raw.slice(

          10,

          12

        )

      : "00";





  const second =

    raw.length >= 14

      ? raw.slice(

          12,

          14

        )

      : "00";





  return (

    `${year}-${month}-${day} ` +

    `${hour}:${minute}:${second}`

  );

}





// ======================================================

// NUMBER

// ======================================================



function numberOrZero(

  value: unknown

): number {



  const number =

    Number(

      value

    );





  return Number.isFinite(

    number

  )

    ? number

    : 0;

}





// ======================================================

// SAVE IMPORT

//

// onProgress:

// 1/231

// 2/231

// ...

// 231/231

//

// Callback chỉ chạy SAU KHI hồ sơ đó đã lưu xong:

// - medical_cases

// - medical_xml_files

// - medical_events

// ======================================================



function normalizeDataDate(

  value: unknown

): string | null {



  if (

    value === undefined ||

    value === null

  ) {

    return null;

  }



  const raw =

    String(value)

      .trim()

      .replace(/\D/g, "");



  if (

    raw.length < 8

  ) {

    return null;

  }



  const year =

    raw.slice(0, 4);



  const month =

    raw.slice(4, 6);



  const day =

    raw.slice(6, 8);



  return (

    `${year}-${month}-${day}`

  );

}





function getImportDataDate(

  result: ParsedBhytResult

): string {



  const dates =

    new Set<string>();



  for (

    const medicalCase

    of result.cases ?? []

  ) {



    const xml1 =

      medicalCase.files?.find(

        (file: any) =>

          String(

            file.type ?? ""

          ).toUpperCase() === "XML1"

      );



    const tongHop =

      xml1?.data?.TONG_HOP ??

      {};



    // Ưu tiên ngày thanh toán.

    // Nếu không có thì ngày ra,

    // cuối cùng mới dùng ngày vào.

    const rawDate =

      tongHop.NGAY_TTOAN ??

      tongHop.NGAY_RA ??

      tongHop.NGAY_VAO ??

      medicalCase.ngayRa ??

      medicalCase.ngayVao;



    const dataDate =

      normalizeDataDate(

        rawDate

      );



    if (dataDate) {

      dates.add(

        dataDate

      );

    }

  }



  if (

    dates.size === 0

  ) {

    throw new Error(

      "Không xác định được ngày dữ liệu khám chữa bệnh."

    );

  }



  // File của bạn đang import theo từng ngày.

  // Không cho một file chứa lẫn nhiều ngày.

  if (

    dates.size > 1

  ) {

    throw new Error(

      "File XML chứa hồ sơ của nhiều ngày khác nhau: " +

      Array.from(dates).join(", ")

    );

  }



  return Array.from(

    dates

  )[0];

}





export type TreatmentGroup = "GENERAL" | "YHCT";

const YHCT_CODES = new Set([
  "08.0313.0230", "08.0278.0230",
  "08.0432.0280", "08.0392.0280",
  // Cấy chỉ: mã đã được xác minh tại danh mục DVKT của bệnh viện.
  "08.0241.0227", "08.0246.0227",
]);

function xml3DetailRows(parsed: any): any[] {
  const root = Array.isArray(parsed) ? parsed[0] : parsed;
  const section = root?.CHITIEU_CHITIET_DVKT_VTYT;
  const details = (Array.isArray(section) ? section[0] : section)
    ?.DSACH_CHI_TIET_DVKT;
  const rows = (Array.isArray(details) ? details[0] : details)
    ?.CHI_TIET_DVKT;
  return Array.isArray(rows) ? rows : rows ? [rows] : [];
}

function classifyCase(medicalCase: any): TreatmentGroup {
  const files: any[] = medicalCase.files ?? [];
  for (const file of files) {
    if (String(file.type ?? "").trim().toUpperCase() !== "XML3") continue;
    if (xml3DetailRows(file.data).some((row) =>
      YHCT_CODES.has(String(row?.MA_DICH_VU ?? "").trim())
    )) return "YHCT";
  }
  return "GENERAL";
}

/**
 * Safety: a single input must contain exactly one group.
 * Mixed files are rejected rather than deleting another group's data.
 * Expand YHCT_CODES when the facility's official YHCT catalog is ready.
 */
export function validateRequestedTreatmentGroup(
  result: ParsedBhytResult,
  requestedGroup: TreatmentGroup
): { treatmentGroup: TreatmentGroup; detectedYhctCases: number; totalCases: number } {
  if (requestedGroup !== "GENERAL" && requestedGroup !== "YHCT") {
    throw new Error("Phải chọn nhóm import GENERAL hoặc YHCT.");
  }
  const cases = result.cases ?? [];
  if (cases.length === 0) throw new Error("File XML không chứa hồ sơ.");
  const detectedYhctCases = cases.filter((item) => classifyCase(item) === "YHCT").length;
  // A GENERAL upload must not contain any known YHCT services.
  if (requestedGroup === "GENERAL" && detectedYhctCases > 0) {
    throw new Error(
      `File có ${detectedYhctCases} hồ sơ sử dụng mã kỹ thuật YHCT đã nhận diện. ` +
      "Không thể import vào nhóm GENERAL; hãy kiểm tra và chọn đúng nhóm."
    );
  }
  // If a file claimed as YHCT contains ordinary records, block mixed imports.
  // No recognised codes means ambiguous; require catalog/explicit validation,
  // rather than silently deleting/replacing data with an uncertain classification.
  if (requestedGroup === "YHCT" && detectedYhctCases !== cases.length) {
    throw new Error(
      `Chỉ nhận diện ${detectedYhctCases}/${cases.length} hồ sơ YHCT theo danh mục hiện có. ` +
      "Chưa thể xác nhận toàn bộ file thuộc YHCT. Dừng import để bảo vệ dữ liệu; " +
      "cần bổ sung mã DVKT hoặc xác minh hồ sơ trước."
    );
  }
  return { treatmentGroup: requestedGroup, detectedYhctCases, totalCases: cases.length };
}

export async function saveBhytImport(

  fileName: string,



  result: ParsedBhytResult,



  onProgress?: ImportProgressCallback,
  requestedGroup?: TreatmentGroup
) {



  const client =

    await db.connect();





  try {



    // ==================================================

    // TRANSACTION

    //

    // Import lỗi ở giữa:

    // ROLLBACK toàn bộ.

    //

    // Dữ liệu ngày cũ cũng không bị mất.

    // ==================================================



    await client.query(

      "BEGIN"

    );





    // ==================================================

    // KIỂM TRA THÔNG TIN FILE

    // ==================================================



    const facilityCode =

      String(

        result.facilityCode ??

        ""

      ).trim();





    const createdDate =

      String(

        result.createdDate ??

        ""

      ).trim();

const dataDate =

  getImportDataDate(

    result

  );
    if (!requestedGroup) {
      throw new Error("Thiếu nhóm import. Hãy cập nhật giao diện và chọn GENERAL hoặc YHCT.");
    }
    const { treatmentGroup } = validateRequestedTreatmentGroup(result, requestedGroup);



    if (

      !facilityCode

    ) {

      throw new Error(

        "Không xác định được mã CSKCB trong file XML."

      );

    }





    if (

      !createdDate

    ) {

      throw new Error(

        "Không xác định được ngày lập hồ sơ trong file XML."

      );

    }





    // ==================================================

    // TỔNG SỐ HỒ SƠ

    // ==================================================



    const cases =

      result.cases ??

      [];





    const totalCases =

      cases.length;





    // Báo trạng thái ban đầu

    onProgress?.(

      0,

      totalCases

    );





    // ==================================================

    // CHUẨN BỊ BATCH

    //

    // Cùng:

    // MA_CSKCB + NGAYLAP

    //

    // => tự động replace dữ liệu cũ.

    // ==================================================



 const prepared =

  await prepareImportBatch(

    client,

    {

      fileName,



      facilityCode,



      createdDate,



      dataDate,
      treatmentGroup,



      declaredTotal:

        result.declaredTotal,

    }

  );





    const batchId =

      prepared.batchId;





    let savedCases =

      0;



    let savedXmlFiles =

      0;



    let savedEvents =

      0;





    // ==================================================

    // DUYỆT TỪNG HỒ SƠ

    //

    // Dùng index để tính progress thật.

    // ==================================================



    for (

      let caseIndex = 0;

      caseIndex <

      totalCases;

      caseIndex++

    ) {



      const medicalCase =

        cases[

          caseIndex

        ];





      // ================================================

      // XML1

      // ================================================



      const xml1 =

        medicalCase

          .files

          ?.find(

            (

              file: any

            ) =>

              String(

                file.type ??

                ""

              ).toUpperCase() ===

              "XML1"

          );





      const tongHop =

        xml1

          ?.data

          ?.TONG_HOP ??

        {};





      // ================================================

      // INSERT MEDICAL CASE

      // ================================================



      const caseResult =

        await client.query(

          `

          INSERT INTO

            core.medical_cases

          (

            import_batch_id,



            ma_lk,

            ma_bn,

            ho_ten,

            ma_the_bhyt,

            gioi_tinh,



            ma_loai_kcb,

            ma_khoa,

            ma_cskcb,



            ngay_vao,

            ngay_ra,

            ngay_ttoan,



            t_tongchi,

            t_bhtt,

            t_bntt,



            nam_qt,

            thang_qt,



            treatment_group,
            status

          )



          VALUES (

            $1,

            $2,

            $3,

            $4,

            $5,

            $6,

            $7,

            $8,

            $9,

            $10,

            $11,

            $12,

            $13,

            $14,

            $15,

            $16,

            $17,
            $18,

            'UNCHECKED'

          )



          RETURNING id

          `,

          [

            batchId,





            tongHop.MA_LK ??

              medicalCase.maLk ??

              null,





            tongHop.MA_BN ??

              medicalCase.maBn ??

              null,





            tongHop.HO_TEN ??

              medicalCase.hoTen ??

              null,





            tongHop.MA_THE_BHYT ??

              null,





            tongHop.GIOI_TINH ??

              null,





            tongHop.MA_LOAI_KCB ??

              null,





            tongHop.MA_KHOA ??

              null,





            tongHop.MA_CSKCB ??

              facilityCode,





            bhytDateTime(

              tongHop.NGAY_VAO ??

              medicalCase.ngayVao

            ),





            bhytDateTime(

              tongHop.NGAY_RA ??

              medicalCase.ngayRa

            ),





            bhytDateTime(

              tongHop.NGAY_TTOAN

            ),





            numberOrZero(

              tongHop.T_TONGCHI_BV ??

              tongHop.T_TONGCHI ??

              medicalCase.tongChi

            ),





            numberOrZero(

              tongHop.T_BHTT

            ),





            // Tien benh nhan phai thanh toan = tu tra + cung chi tra BHYT.
            numberOrZero(tongHop.T_BNTT) +
              numberOrZero(tongHop.T_BNCCT),





            tongHop.NAM_QT

              ? Number(

                  tongHop.NAM_QT

                )

              : null,





            tongHop.THANG_QT

              ? Number(

                  tongHop.THANG_QT

                )

              : null,

                      treatmentGroup,

]

        );





      const medicalCaseId =

        caseResult

          .rows[0]

          .id;





      savedCases++;





      // ================================================

      // XML1 / XML2 / XML3...

      // ================================================



      for (

        const file

        of medicalCase.files ??

        []

      ) {



        // ==============================================

        // LƯU XML GỐC

        // ==============================================



        await client.query(

          `

          INSERT INTO

            core.medical_xml_files

          (

            medical_case_id,

            xml_type,

            raw_xml,

            parsed_data

          )



          VALUES (

            $1,

            $2,

            $3,

            $4::jsonb

          )

          `,

          [

            medicalCaseId,



            file.type,



            file.rawXml,



            JSON.stringify(

              file.data ??

              {}

            ),

          ]

        );





        savedXmlFiles++;





        // ==============================================

        // XML2 / XML3

        // -> MEDICAL EVENTS

        // ==============================================



        if (

          file.type ===

            "XML2" ||



          file.type ===

            "XML3"

        ) {



          const events =

            normalizeXmlFile(

              file.type,

              file.data

            );





          for (

            const event

            of events

          ) {



            await client.query(

              `

              INSERT INTO

                core.medical_events

              (

                medical_case_id,



                ma_lk,



                source_type,

                event_type,



                item_code,

                item_name,



                doctor_code,

                performer_code,



                department_code,



                start_time,

                end_time,



                raw_data

              )



              VALUES (

                $1,

                $2,

                $3,

                $4,

                $5,

                $6,

                $7,

                $8,

                $9,

                $10,

                $11,

                $12::jsonb

              )

              `,

              [

                medicalCaseId,





                event.maLk ??

                  tongHop.MA_LK ??

                  medicalCase.maLk ??

                  null,





                event.sourceType,



                event.eventType,





                event.itemCode ??

                  null,



                event.itemName ??

                  null,





                event.doctorCode ??

                  null,



                event.performerCode ??

                  null,





                event.departmentCode ??

                  null,





                event.startTime ??

                  null,



                event.endTime ??

                  null,





                JSON.stringify(

                  event.rawData ??

                  {}

                ),

              ]

            );





            savedEvents++;

          }

        }

      }





      // ================================================

      // HỒ SƠ NÀY ĐÃ LƯU HOÀN CHỈNH

      //

      // Lúc này mới tăng progress.

      // ================================================



      onProgress?.(

        caseIndex + 1,

        totalCases

      );

    }





    // ==================================================

    // HOÀN TẤT BATCH

    // ==================================================



    await finishImportBatch(

      client,

      batchId,

      savedCases

    );





    // ==================================================

    // COMMIT

    // ==================================================



    await client.query(

      "COMMIT"

    );





    // ==================================================

    // RESULT

    // ==================================================



    return {

      batchId,
      treatmentGroup,



      facilityCode,



      createdDate,



      replaced:

        prepared.replaced,



      deletedCases:

        prepared.deletedCases,



      previousFileName:

        prepared.previousFileName ??

        null,



      previousActualTotal:

        prepared.previousActualTotal ??

        0,



      declaredTotal:

        result.declaredTotal,



      actualTotal:

        result.actualTotal,



      savedCases,



      savedXmlFiles,



      savedEvents,

    };



  } catch (error) {



    // ==================================================

    // IMPORT BỊ LỖI

    // => ROLLBACK TOÀN BỘ

    // ==================================================



    try {



      await client.query(

        "ROLLBACK"

      );



    } catch (

      rollbackError

    ) {



      console.error(

        "Rollback import XML error:",

        rollbackError

      );

    }





    throw error;



  } finally {



    client.release();

  }

}