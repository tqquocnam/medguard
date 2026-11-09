export interface ImportValidationError {
  code: string;
  message: string;
}

export interface ImportCaseValidation {
  index: number;
  maLk: string | null;
  maBn: string | null;
  hoTen: string | null;
  ngayVao: string | null;
  ngayRa: string | null;
  tongChi: string | number | null;
  xmlTypes: string[];
  valid: boolean;
  errors: ImportValidationError[];
}

type Row = Record<string, unknown>;

// Cấu trúc XML1 theo file XML bạn cung cấp.
// Kiểm tra sự hiện diện của thẻ, kể cả thẻ được phép để trống.
const XML1_FIELDS = [
  "MA_LK",
  "STT",
  "MA_BN",
  "HO_TEN",
  "SO_CCCD",
  "NGAY_SINH",
  "GIOI_TINH",
  "NHOM_MAU",
  "MA_QUOCTICH",
  "MA_DANTOC",
  "MA_NGHE_NGHIEP",
  "DIA_CHI",
  "MATINH_CU_TRU",
  "MAHUYEN_CU_TRU",
  "MAXA_CU_TRU",
  "DIEN_THOAI",
  "MA_THE_BHYT",
  "MA_DKBD",
  "GT_THE_TU",
  "GT_THE_DEN",
  "NGAY_MIEN_CCT",
  "LY_DO_VV",
  "LY_DO_VNT",
  "MA_LY_DO_VNT",
  "CHAN_DOAN_VAO",
  "CHAN_DOAN_RV",
  "MA_BENH_CHINH",
  "MA_BENH_KT",
  "MA_BENH_YHCT",
  "MA_PTTT_QT",
  "MA_DOITUONG_KCB",
  "MA_NOI_DI",
  "MA_NOI_DEN",
  "MA_TAI_NAN",
  "NGAY_VAO",
  "NGAY_VAO_NOI_TRU",
  "NGAY_RA",
  "GIAY_CHUYEN_TUYEN",
  "SO_NGAY_DTRI",
  "PP_DIEU_TRI",
  "KET_QUA_DTRI",
  "MA_LOAI_RV",
  "GHI_CHU",
  "NGAY_TTOAN",
  "T_THUOC",
  "T_VTYT",
  "T_TONGCHI_BV",
  "T_TONGCHI_BH",
  "T_BNTT",
  "T_BNCCT",
  "T_BHTT",
  "T_NGUONKHAC",
  "T_BHTT_GDV",
  "NAM_QT",
  "THANG_QT",
  "MA_LOAI_KCB",
  "MA_KHOA",
  "MA_CSKCB",
  "MA_KHUVUC",
  "CAN_NANG",
  "CAN_NANG_CON",
  "NAM_NAM_LIEN_TUC",
  "NGAY_TAI_KHAM",
  "MA_HSBA",
  "MA_TTDV",
  "DU_PHONG",
] as const;

// Chính sách kiểm tra dữ liệu bắt buộc của MedGuard.
// Các trường còn lại trong XML1_FIELDS được phép có giá trị trống.
// Giá trị số 0 vẫn được tính là có dữ liệu.
const REQUIRED_XML1_FIELDS: Record<string, string> = {
  MA_LK: "mã liên kết",
  STT: "số thứ tự",
  MA_BN: "mã bệnh nhân",
  HO_TEN: "họ và tên",
  NGAY_SINH: "ngày sinh",
  GIOI_TINH: "giới tính",
  MA_QUOCTICH: "mã quốc tịch",
  MA_DANTOC: "mã dân tộc",
  MA_NGHE_NGHIEP: "mã nghề nghiệp",
  DIA_CHI: "địa chỉ",
  MATINH_CU_TRU: "mã tỉnh cư trú",
  MAHUYEN_CU_TRU: "mã huyện cư trú",
  MAXA_CU_TRU: "mã xã cư trú",
  MA_THE_BHYT: "mã thẻ BHYT",
  MA_DKBD: "mã nơi đăng ký khám ban đầu",
  GT_THE_TU: "ngày bắt đầu giá trị thẻ",
  GT_THE_DEN: "ngày kết thúc giá trị thẻ",
  LY_DO_VV: "lý do vào viện",
  CHAN_DOAN_VAO: "chẩn đoán vào viện",
  CHAN_DOAN_RV: "chẩn đoán ra viện",
  MA_BENH_CHINH: "mã bệnh chính",
  MA_DOITUONG_KCB: "mã đối tượng khám chữa bệnh",
  MA_TAI_NAN: "mã tai nạn",
  NGAY_VAO: "thời gian vào viện",
  NGAY_RA: "thời gian ra viện",
  SO_NGAY_DTRI: "số ngày điều trị",
  KET_QUA_DTRI: "kết quả điều trị",
  MA_LOAI_RV: "mã loại ra viện",
  NGAY_TTOAN: "thời gian thanh toán",
  T_THUOC: "tiền thuốc",
  T_VTYT: "tiền vật tư y tế",
  T_TONGCHI_BV: "tổng chi phí bệnh viện",
  T_TONGCHI_BH: "tổng chi phí bảo hiểm",
  T_BNTT: "tiền bệnh nhân tự trả",
  T_BNCCT: "tiền bệnh nhân cùng chi trả",
  T_BHTT: "tiền BHYT thanh toán",
  T_NGUONKHAC: "tiền nguồn khác",
  T_BHTT_GDV: "tiền BHYT thanh toán gói dịch vụ",
  NAM_QT: "năm quyết toán",
  THANG_QT: "tháng quyết toán",
  MA_LOAI_KCB: "mã loại khám chữa bệnh",
  MA_KHOA: "mã khoa",
  MA_CSKCB: "mã cơ sở khám chữa bệnh",
  CAN_NANG: "cân nặng (kg)",
};

function object(value: unknown): Row {
  if (Array.isArray(value)) return object(value[0]);

  return value !== null && typeof value === "object" ? (value as Row) : {};
}

function text(value: unknown): string {
  if (Array.isArray(value)) {
    return value.length === 1 ? text(value[0]) : "";
  }

  if (value !== null && typeof value === "object") {
    const row = value as Row;
    return "#text" in row ? text(row["#text"]) : "";
  }

  return value === null || value === undefined ? "" : String(value).trim();
}

function hasField(row: Row, field: string): boolean {
  return Object.prototype.hasOwnProperty.call(row, field);
}

// Dùng UTC để so sánh thời gian ổn định trên localhost và VPS.
// Không tự sửa các ngày sai như 31/02 thành ngày khác.
function parseBhytTime(value: unknown): Date | null {
  const raw = text(value);

  if (!/^(?:\d{8}|\d{12}|\d{14})$/.test(raw)) {
    return null;
  }

  const year = Number(raw.slice(0, 4));
  const month = Number(raw.slice(4, 6));
  const day = Number(raw.slice(6, 8));
  const hour = Number(raw.slice(8, 10) || "0");
  const minute = Number(raw.slice(10, 12) || "0");
  const second = Number(raw.slice(12, 14) || "0");

  if (
    year < 1900 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  ) {
    return null;
  }

  const result = new Date(Date.UTC(year, month - 1, day, hour, minute, second));

  if (
    result.getUTCFullYear() !== year ||
    result.getUTCMonth() !== month - 1 ||
    result.getUTCDate() !== day ||
    result.getUTCHours() !== hour ||
    result.getUTCMinutes() !== minute ||
    result.getUTCSeconds() !== second
  ) {
    return null;
  }

  return result;
}

function formatTime(value: unknown): string {
  const raw = text(value);
  const date = parseBhytTime(raw);

  if (!date) return raw;

  const pad = (number: number) => String(number).padStart(2, "0");

  const formatted =
    `${pad(date.getUTCDate())}/` +
    `${pad(date.getUTCMonth() + 1)}/` +
    `${date.getUTCFullYear()} ` +
    `${pad(date.getUTCHours())}:` +
    `${pad(date.getUTCMinutes())}`;

  return raw.length === 14 ? `${formatted}:${pad(date.getUTCSeconds())}` : formatted;
}

function collectObjects(data: unknown, result: Row[] = []): Row[] {
  if (Array.isArray(data)) {
    for (const item of data) collectObjects(item, result);
    return result;
  }

  if (data === null || typeof data !== "object") {
    return result;
  }

  const row = data as Row;
  result.push(row);

  for (const value of Object.values(row)) {
    collectObjects(value, result);
  }

  return result;
}

function checkXml1Fields(tongHop: Row): ImportValidationError[] {
  const errors: ImportValidationError[] = [];

  for (const field of XML1_FIELDS) {
    const label = REQUIRED_XML1_FIELDS[field];

    if (!hasField(tongHop, field)) {
      errors.push({
        code: `MISSING_XML1_TAG_${field}`,
        message: label ? `XML1: Thiếu thẻ ${field} — ${label}.` : `XML1: Thiếu thẻ ${field}.`,
      });
      continue;
    }

    if (label && !text(tongHop[field])) {
      errors.push({
        code: `EMPTY_XML1_${field}`,
        message: `XML1: Thiếu ${label} (${field}); giá trị đang để trống.`,
      });
    }
  }

  const weight = text(tongHop.CAN_NANG);

  if (weight) {
    // Chấp nhận 55,5 hoặc 55.5; không chấp nhận chữ hay đơn vị.
    const normalized = weight.replace(",", ".");
    const validNumber = /^\d+(?:\.\d+)?$/.test(normalized);
    const value = Number(normalized);

    if (!validNumber || !Number.isFinite(value) || value <= 0) {
      errors.push({
        code: "INVALID_XML1_CAN_NANG",
        message:
          `XML1: Cân nặng (CAN_NANG) "${weight}" không hợp lệ; ` + "phải là số kg lớn hơn 0.",
      });
    }
  }

  return errors;
}
// NGAY_SINH được phép chỉ biết năm hoặc biết năm + tháng.
// Ví dụ:
// 196300000000 -> chỉ biết năm 1963.
// 196305000000 -> biết tháng 05/1963.
// 196305210000 -> biết ngày 21/05/1963.
//
// Không thay đổi cách kiểm tra ngày vào, ngày ra, y lệnh.
function isValidBirthDate(value: unknown): boolean {
  const raw = text(value);

  if (!/^(?:\d{4}|\d{8}|\d{12}|\d{14})$/.test(raw)) {
    return false;
  }

  const year = Number(raw.slice(0, 4));

  if (year < 1900 || year > new Date().getUTCFullYear()) {
    return false;
  }

  // Chỉ có năm.
  if (raw.length === 4) return true;

  const month = Number(raw.slice(4, 6));
  const day = Number(raw.slice(6, 8));
  const timePart = raw.slice(8);

  // Không biết tháng/ngày: phần còn lại phải bằng 0.
  if (month === 0 && day === 0) {
    return /^0*$/.test(timePart);
  }

  // Không thể biết ngày khi không biết tháng.
  if (month < 1 || month > 12) {
    return false;
  }

  // Biết năm + tháng, chưa biết ngày.
  if (day === 0) {
    return /^0*$/.test(timePart);
  }

  // Có đầy đủ ngày/tháng/năm thì kiểm tra ngày thực tế.
  return parseBhytTime(raw) !== null;
}

function checkXml1Dates(tongHop: Row): ImportValidationError[] {
  const errors: ImportValidationError[] = [];

  const birthDate = text(tongHop.NGAY_SINH);

  // Thiếu/trống đã được báo tại checkXml1Fields().
  if (birthDate && !isValidBirthDate(birthDate)) {
    errors.push({
      code: "INVALID_NGAY_SINH",
      message:
        `XML1: NGAY_SINH "${birthDate}" không hợp lệ. ` +
        "Cho phép chỉ có năm sinh, năm/tháng sinh hoặc ngày sinh đầy đủ; " +
        "phần tháng/ngày chưa biết được ghi bằng 00.",
    });
  }

  // Các ngày này vẫn phải là ngày thực tế hợp lệ.
  const fields = ["GT_THE_TU", "GT_THE_DEN", "NGAY_VAO", "NGAY_RA", "NGAY_TTOAN"];

  for (const field of fields) {
    const value = text(tongHop[field]);

    if (value && !parseBhytTime(value)) {
      errors.push({
        code: `INVALID_${field}`,
        message:
          `XML1: ${field} "${value}" không hợp lệ. ` +
          "Định dạng: YYYYMMDD, YYYYMMDDHHmm hoặc YYYYMMDDHHmmss.",
      });
    }
  }

  const start = parseBhytTime(tongHop.NGAY_VAO);
  const end = parseBhytTime(tongHop.NGAY_RA);

  if (start && end && end.getTime() < start.getTime()) {
    errors.push({
      code: "INVALID_VISIT_TIME",
      message:
        `XML1: Thời gian ra viện ${formatTime(tongHop.NGAY_RA)} ` +
        `trước thời gian vào viện ${formatTime(tongHop.NGAY_VAO)}.`,
    });
  }

  return errors;
}

function checkOrderTimes(files: Row[]): ImportValidationError[] {
  const errors: ImportValidationError[] = [];

  for (const file of files) {
    const xmlType = text(file.type).toUpperCase();

    if (xmlType !== "XML2" && xmlType !== "XML3") {
      continue;
    }

    for (const row of collectObjects(file.data)) {
      const ngayYl = row.NGAY_YL ?? row.NGAY_CHI_DINH;

      const ngayThYl = row.NGAY_TH_YL ?? row.NGAY_THUC_HIEN_YL ?? row.NGAY_THUC_HIEN;

      if (!text(ngayYl) || !text(ngayThYl)) {
        continue;
      }

      const itemName =
        text(row.TEN_DICH_VU) ||
        text(row.TEN_THUOC) ||
        text(row.MA_DICH_VU) ||
        text(row.MA_THUOC) ||
        "Y lệnh";

      const orderTime = parseBhytTime(ngayYl);
      const performTime = parseBhytTime(ngayThYl);

      if (!orderTime || !performTime) {
        errors.push({
          code: "INVALID_ORDER_TIME",
          message: `${itemName}: thời gian y lệnh hoặc ` + "thời gian thực hiện không hợp lệ.",
        });
        continue;
      }

      if (performTime.getTime() < orderTime.getTime()) {
        errors.push({
          code: "PERFORM_BEFORE_ORDER",
          message:
            `${itemName}: thời gian thực hiện ` +
            `${formatTime(ngayThYl)} trước thời gian y lệnh ` +
            `${formatTime(ngayYl)}.`,
        });
      }
    }
  }

  return errors;
}

export function validateImportFile(parsed: unknown) {
  const source = object(parsed);
  const cases = Array.isArray(source.cases) ? source.cases : [];

  const results: ImportCaseValidation[] = [];

  for (let index = 0; index < cases.length; index++) {
    const medicalCase = object(cases[index]);

    const files = Array.isArray(medicalCase.files)
      ? medicalCase.files.map((file) => object(file))
      : [];

    const errors: ImportValidationError[] = [];

    const xml1Files = files.filter((file) => text(file.type).toUpperCase() === "XML1");

    const xml1 = xml1Files[0];
    const xml1Data = object(xml1?.data);
    const rawTongHop = xml1Data.TONG_HOP;
    const tongHop = object(rawTongHop);

    if (!xml1) {
      errors.push({
        code: "MISSING_XML1",
        message: "Hồ sơ không có XML1.",
      });
    } else if (
      rawTongHop === null ||
      typeof rawTongHop !== "object" ||
      (Array.isArray(rawTongHop) &&
        (rawTongHop.length !== 1 ||
          rawTongHop[0] === null ||
          typeof rawTongHop[0] !== "object" ||
          Array.isArray(rawTongHop[0])))
    ) {
      errors.push({
        code: "INVALID_XML1_TONG_HOP",
        message: "XML1: Không tìm thấy một phần dữ liệu TONG_HOP hợp lệ.",
      });
    } else {
      errors.push(...checkXml1Fields(tongHop), ...checkXml1Dates(tongHop));
    }

    if (xml1Files.length > 1) {
      errors.push({
        code: "DUPLICATE_XML1",
        message: "Hồ sơ có nhiều hơn một XML1.",
      });
    }

    errors.push(...checkOrderTimes(files));

    // Fallback chỉ phục vụ hiển thị.
    // Kiểm tra trường bắt buộc luôn đọc trực tiếp XML1,
    // không lấy dữ liệu fallback để bỏ qua lỗi thiếu trường.
    const maLk = text(tongHop.MA_LK) || text(medicalCase.maLk) || null;

    const maBn = text(tongHop.MA_BN) || text(medicalCase.maBn) || null;

    const hoTen = text(tongHop.HO_TEN) || text(medicalCase.hoTen) || null;

    const ngayVao = text(tongHop.NGAY_VAO) || text(medicalCase.ngayVao) || null;

    const ngayRa = text(tongHop.NGAY_RA) || text(medicalCase.ngayRa) || null;

    const tongChi =
      text(tongHop.T_TONGCHI_BV) || text(tongHop.T_TONGCHI) || text(medicalCase.tongChi) || null;

    results.push({
      index: index + 1,
      maLk,
      maBn,
      hoTen,
      ngayVao,
      ngayRa,
      tongChi,
      xmlTypes: [...new Set(files.map((file) => text(file.type).toUpperCase()).filter(Boolean))],
      valid: errors.length === 0,
      errors,
    });
  }

  const invalid = results.filter((item) => !item.valid).length;

  return {
    // File không có hồ sơ cũng không được import.
    canImport: results.length > 0 && invalid === 0,
    summary: {
      total: results.length,
      valid: results.length - invalid,
      invalid,
    },
    cases: results,
  };
}
