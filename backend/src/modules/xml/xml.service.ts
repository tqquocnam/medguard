
import { db } from "../../config/database.js";

import {
  prepareImportBatch,
  finishImportBatch,
} from "./import-batch.service.js";

import {
  normalizeXmlFile,
} from "../medical-event/event.normalizer.js";

import {
  replaceCaseExamDoctors,
} from "../medical-case/exam-doctor.repository.js";

// ======================================================
// TYPES
// ======================================================

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

export type TreatmentGroup = "GENERAL" | "YHCT";

// ======================================================
// HELPER
// ======================================================

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function firstObject(value: any): any {
  return Array.isArray(value) ? value[0] : value;
}

// ======================================================
// CHUYỂN NGÀY BHYT -> POSTGRESQL DATETIME
// ======================================================

function bhytDateTime(
  value?: unknown
): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const raw = String(value).trim();

  if (raw.length < 8) {
    return null;
  }

  const year = raw.slice(0, 4);
  const month = raw.slice(4, 6);
  const day = raw.slice(6, 8);

  const hour =
    raw.length >= 10 ? raw.slice(8, 10) : "00";

  const minute =
    raw.length >= 12 ? raw.slice(10, 12) : "00";

  const second =
    raw.length >= 14 ? raw.slice(12, 14) : "00";

  return (
    `${year}-${month}-${day} ` +
    `${hour}:${minute}:${second}`
  );
}

// ======================================================
// NUMBER
// ======================================================

function numberOrZero(value: unknown): number {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : 0;
}

// ======================================================
// NORMALIZE DATA DATE
// ======================================================

function normalizeDataDate(
  value: unknown
): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const raw = String(value)
    .trim()
    .replace(/\D/g, "");

  if (raw.length < 8) {
    return null;
  }

  const year = raw.slice(0, 4);
  const month = raw.slice(4, 6);
  const day = raw.slice(6, 8);

  return `${year}-${month}-${day}`;
}

// ======================================================
// XÁC ĐỊNH NGÀY DỮ LIỆU IMPORT
// ======================================================

function getImportDataDate(
  result: ParsedBhytResult
): string {
  const dates = new Set<string>();

  for (const medicalCase of result.cases ?? []) {
    const xml1 = medicalCase.files?.find(
      (file: any) =>
        text(file.type).toUpperCase() === "XML1"
    );

    const tongHop =
      firstObject(xml1?.data?.TONG_HOP) ?? {};

    // Ưu tiên ngày thanh toán.
    // Nếu không có, lấy ngày ra rồi ngày vào.
    const rawDate =
      tongHop.NGAY_TTOAN ??
      tongHop.NGAY_RA ??
      tongHop.NGAY_VAO ??
      medicalCase.ngayRa ??
      medicalCase.ngayVao;

    const dataDate = normalizeDataDate(rawDate);

    if (dataDate) {
      dates.add(dataDate);
    }
  }

  if (dates.size === 0) {
    throw new Error(
      "Không xác định được ngày dữ liệu khám chữa bệnh."
    );
  }

  // Không cho phép một file chứa hồ sơ nhiều ngày.
  if (dates.size > 1) {
    throw new Error(
      "File XML chứa hồ sơ của nhiều ngày khác nhau: " +
      Array.from(dates).join(", ")
    );
  }

  return Array.from(dates)[0];
}

// ======================================================
// DANH MỤC NHẬN DIỆN YHCT
// ======================================================


const YHCT_CODES = new Set<string>([
  // Điện châm
  "08.0313.0230",
  "08.0278.0230",
  "08.0301.0230",

  // Xoa bóp, bấm huyệt
  "08.0432.0280",
  "08.0392.0280",
  "08.0391.0280",

  // Cấy chỉ
  "08.0241.0227",
  "08.0246.0227",
]);


// ======================================================
// ĐỌC CHI TIẾT XML3
// ======================================================

function xml3DetailRows(parsed: any): any[] {
  const root = firstObject(parsed);

  const section = firstObject(
    root?.CHITIEU_CHITIET_DVKT_VTYT
  );

  const details = firstObject(
    section?.DSACH_CHI_TIET_DVKT
  );

  const rows = details?.CHI_TIET_DVKT;

  if (Array.isArray(rows)) {
    return rows;
  }

  return rows ? [rows] : [];
}

// ======================================================
// PHÂN LOẠI HỒ SƠ GENERAL / YHCT
// ======================================================

function classifyCase(
  medicalCase: any
): TreatmentGroup {
  const files: any[] = medicalCase.files ?? [];

  for (const file of files) {
    if (
      text(file.type).toUpperCase() !== "XML3"
    ) {
      continue;
    }

    const rows = xml3DetailRows(file.data);

    const hasYhct = rows.some((row) =>
      YHCT_CODES.has(text(row?.MA_DICH_VU))
    );

    if (hasYhct) {
      return "YHCT";
    }
  }

  return "GENERAL";
}

// ======================================================
// VALIDATE NHÓM IMPORT
// ======================================================

export function validateRequestedTreatmentGroup(
  result: ParsedBhytResult,
  requestedGroup: TreatmentGroup
): {
  treatmentGroup: TreatmentGroup;
  detectedYhctCases: number;
  totalCases: number;
} {
  if (
    requestedGroup !== "GENERAL" &&
    requestedGroup !== "YHCT"
  ) {
    throw new Error(
      "Phải chọn nhóm import GENERAL hoặc YHCT."
    );
  }

  const cases = result.cases ?? [];

  if (cases.length === 0) {
    throw new Error(
      "File XML không chứa hồ sơ."
    );
  }

  const detectedYhctCases = cases.filter(
    (item) => classifyCase(item) === "YHCT"
  ).length;

  if (
    requestedGroup === "GENERAL" &&
    detectedYhctCases > 0
  ) {
    throw new Error(
      `File có ${detectedYhctCases} hồ sơ sử dụng ` +
      "mã kỹ thuật YHCT đã nhận diện. " +
      "Không thể import vào nhóm GENERAL; " +
      "hãy kiểm tra và chọn đúng nhóm."
    );
  }

  if (
    requestedGroup === "YHCT" &&
    detectedYhctCases !== cases.length
  ) {
    throw new Error(
      `Chỉ nhận diện ${detectedYhctCases}/` +
      `${cases.length} hồ sơ YHCT theo danh mục hiện có. ` +
      "Chưa thể xác nhận toàn bộ file thuộc YHCT. " +
      "Dừng import để bảo vệ dữ liệu; " +
      "cần bổ sung mã DVKT hoặc xác minh hồ sơ trước."
    );
  }

  return {
    treatmentGroup: requestedGroup,
    detectedYhctCases,
    totalCases: cases.length,
  };
}

// ======================================================
// SAVE BHYT IMPORT
// ======================================================

export async function saveBhytImport(
  fileName: string,
  result: ParsedBhytResult,
  onProgress?: ImportProgressCallback,
  requestedGroup?: TreatmentGroup
) {
  const client = await db.connect();

  try {
    // ==================================================
    // TRANSACTION
    // ==================================================

    await client.query("BEGIN");

    // ==================================================
    // THÔNG TIN FILE
    // ==================================================

    const facilityCode = text(result.facilityCode);
    const createdDate = text(result.createdDate);

    const dataDate = getImportDataDate(result);

    if (!requestedGroup) {
      throw new Error(
        "Thiếu nhóm import. " +
        "Hãy cập nhật giao diện và chọn GENERAL hoặc YHCT."
      );
    }

    const { treatmentGroup } =
      validateRequestedTreatmentGroup(
        result,
        requestedGroup
      );

    if (!facilityCode) {
      throw new Error(
        "Không xác định được mã CSKCB trong file XML."
      );
    }

    if (!createdDate) {
      throw new Error(
        "Không xác định được ngày lập hồ sơ trong file XML."
      );
    }

    // ==================================================
    // TỔNG HỒ SƠ
    // ==================================================

    const cases = result.cases ?? [];
    const totalCases = cases.length;

    onProgress?.(0, totalCases);

    // ==================================================
    // CHUẨN BỊ BATCH
    // ==================================================
    // Giữ nguyên nghiệp vụ replace theo:
    // MA_CSKCB + ngày dữ liệu + nhóm import.
    // ==================================================

    const prepared = await prepareImportBatch(
      client,
      {
        fileName,
        facilityCode,
        createdDate,
        dataDate,
        treatmentGroup,
        declaredTotal: result.declaredTotal,
      }
    );

    const batchId = prepared.batchId;

    // ==================================================
    // COUNTERS
    // ==================================================

    let savedCases = 0;
    let savedXmlFiles = 0;
    let savedEvents = 0;

    // MỚI: tổng dòng công khám đã lưu
    let savedExamDoctors = 0;

    // ==================================================
    // DUYỆT TỪNG HỒ SƠ
    // ==================================================

    for (
      let caseIndex = 0;
      caseIndex < totalCases;
      caseIndex++
    ) {
      const medicalCase = cases[caseIndex];

      // ================================================
      // XML1 - TỔNG HỢP
      // ================================================

      const xml1 = medicalCase.files?.find(
        (file: any) =>
          text(file.type).toUpperCase() === "XML1"
      );

      const tongHop =
        firstObject(xml1?.data?.TONG_HOP) ?? {};

      const maLk = text(
        tongHop.MA_LK ??
        medicalCase.maLk
      );

      if (!maLk) {
        throw new Error(
          `Hồ sơ thứ ${caseIndex + 1} thiếu MA_LK.`
        );
      }

      // ================================================
      // INSERT MEDICAL CASE
      // ================================================

      const caseResult = await client.query(
        `
        INSERT INTO core.medical_cases (
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

          maLk,

          tongHop.MA_BN ??
            medicalCase.maBn ??
            null,

          tongHop.HO_TEN ??
            medicalCase.hoTen ??
            null,

          tongHop.MA_THE_BHYT ?? null,

          tongHop.GIOI_TINH ?? null,

          tongHop.MA_LOAI_KCB ?? null,

          tongHop.MA_KHOA ?? null,

          tongHop.MA_CSKCB ?? facilityCode,

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

          // Bệnh nhân tự trả + cùng chi trả
          numberOrZero(tongHop.T_BNTT) +
            numberOrZero(tongHop.T_BNCCT),

          tongHop.NAM_QT
            ? Number(tongHop.NAM_QT)
            : null,

          tongHop.THANG_QT
            ? Number(tongHop.THANG_QT)
            : null,

          treatmentGroup,
        ]
      );

      const medicalCaseId =
        caseResult.rows[0].id;

      savedCases++;

      // ================================================
      // XML FILES
      // ================================================

      for (const file of medicalCase.files ?? []) {
        const xmlType = text(file.type).toUpperCase();

        // ==============================================
        // LƯU XML GỐC
        // ==============================================

        await client.query(
          `
          INSERT INTO core.medical_xml_files (
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
            JSON.stringify(file.data ?? {}),
          ]
        );

        savedXmlFiles++;

        // ==============================================
        // XML2 / XML3 -> MEDICAL EVENTS
        // ==============================================

        if (
          xmlType === "XML2" ||
          xmlType === "XML3"
        ) {
          const events = normalizeXmlFile(
            xmlType,
            file.data
          );

          for (const event of events) {
            await client.query(
              `
              INSERT INTO core.medical_events (
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

                event.maLk ?? maLk,

                event.sourceType,
                event.eventType,

                event.itemCode ?? null,
                event.itemName ?? null,

                event.doctorCode ?? null,
                event.performerCode ?? null,

                event.departmentCode ?? null,

                event.startTime ?? null,
                event.endTime ?? null,

                JSON.stringify(
                  event.rawData ?? {}
                ),
              ]
            );

            savedEvents++;
          }
        }
      }

      // ==================================================
      // MỚI: BÁC SĨ CÔNG KHÁM
      // ==================================================
      //
      // CHỈ XML3:
      //   MA_NHOM = 13
      //
      // Không lấy:
      //   - Bác sĩ kê thuốc
      //   - Bác sĩ CLS
      //   - Bác sĩ thực hiện DVKT khác
      //
      // Lưu trong cùng transaction.
      //
      // ==================================================

      const xml3Files = (
        medicalCase.files ?? []
      ).filter(
        (file: any) =>
          text(file.type).toUpperCase() === "XML3"
      );

      if (xml3Files.length > 0) {
        const examRows = xml3Files.flatMap(
          (file: any) =>
            xml3DetailRows(file.data)
        );

        // Repository sẽ lọc MA_NHOM = 13
        // và lấy mã bác sĩ công khám.
        //
        // Đồng thời thay dữ liệu cũ của MA_LK
        // khi import lại.

        const saved = await replaceCaseExamDoctors(
          client,
          maLk,
          examRows
        );

        savedExamDoctors += saved;
      }

      // ==================================================
      // HOÀN TẤT HỒ SƠ
      // ==================================================

      // Báo tiến trình sau khi các INSERT hoàn tất.
      // Toàn bộ batch chỉ được xác nhận khi COMMIT.

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

    await client.query("COMMIT");

    // ==================================================
    // LOG
    // ==================================================

    console.log(
      "[MedGuard XML Import] Completed",
      {
        batchId,
        savedCases,
        savedXmlFiles,
        savedEvents,
        savedExamDoctors,
      }
    );

    // ==================================================
    // RESULT
    // ==================================================

    return {
      batchId,
      treatmentGroup,

      facilityCode,
      createdDate,

      replaced: prepared.replaced,
      deletedCases: prepared.deletedCases,

      previousFileName:
        prepared.previousFileName ?? null,

      previousActualTotal:
        prepared.previousActualTotal ?? 0,

      declaredTotal: result.declaredTotal,
      actualTotal: result.actualTotal,

      savedCases,
      savedXmlFiles,
      savedEvents,

      // MỚI
      savedExamDoctors,
    };

  } catch (error) {
    // ==================================================
    // ROLLBACK
    // ==================================================

    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
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
