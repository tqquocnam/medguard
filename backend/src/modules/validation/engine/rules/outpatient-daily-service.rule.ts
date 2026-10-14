
import type {
  RuleValidator,
  RuleResult,
  ValidationRule,
} from "../rule.types.js";

type DataObject = Record<string, unknown>;

interface DailyService {
  stt: string;
  maDichVu: string;
  tenDichVu: string;
  maKhoa: string;
  ngayYLenh: string;
  ngayThucHien: string;
  ngayDieuTri: string;
  nguoiThucHien: string;
  soLuong: string;
}

interface DuplicateGroup {
  type: string;
  ngayDieuTri: string;
  maDichVu: string;
  tenDichVu: string;
  stt: string[];
  soDong: number;
  ngayYLenh: string;
  ngayThucHien: string;
  nguoiThucHien: string;
  soLuongMoiDong: string;
  message: string;
}

function isObject(value: unknown): value is DataObject {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function str(value: unknown): string {
  return value === null || value === undefined
    ? ""
    : String(value).trim();
}

function firstObject(value: unknown): DataObject | null {
  const item = Array.isArray(value)
    ? value[0]
    : value;

  return isObject(item) ? item : null;
}

function getXml1(contextXml1: unknown): DataObject | null {
  const root = firstObject(contextXml1);
  return firstObject(root?.TONG_HOP);
}

function getXml3Rows(contextXml3: unknown): DataObject[] {
  const root = firstObject(contextXml3);

  const container = firstObject(
    root?.CHITIEU_CHITIET_DVKT_VTYT
  );

  const list = firstObject(
    container?.DSACH_CHI_TIET_DVKT
  );

  const raw = list?.CHI_TIET_DVKT;

  if (!raw) return [];

  const rows = Array.isArray(raw) ? raw : [raw];

  return rows.filter(isObject);
}

/**
 * Trả về YYYY-MM-DD nếu là thời gian XML hợp lệ.
 * Hỗ trợ YYYYMMDDHHmm và YYYYMMDDHHmmss.
 * Không tự chuyển múi giờ.
 */
function getDateKey(value: unknown): string | null {
  const raw = str(value);

  if (!/^\d{12}(\d{2})?$/.test(raw)) {
    return null;
  }

  const year = Number(raw.slice(0, 4));
  const month = Number(raw.slice(4, 6));
  const day = Number(raw.slice(6, 8));
  const hour = Number(raw.slice(8, 10));
  const minute = Number(raw.slice(10, 12));
  const second =
    raw.length === 14 ? Number(raw.slice(12, 14)) : 0;

  const stamp = Date.UTC(
    year,
    month - 1,
    day,
    hour,
    minute,
    second
  );

  const date = new Date(stamp);

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day ||
    date.getUTCHours() !== hour ||
    date.getUTCMinutes() !== minute ||
    date.getUTCSeconds() !== second
  ) {
    return null;
  }

  return [
    String(year).padStart(4, "0"),
    String(month).padStart(2, "0"),
    String(day).padStart(2, "0"),
  ].join("-");
}

function makeResult(
  rule: ValidationRule,
  status: RuleResult["status"],
  message: string,
  details: Record<string, unknown>,
  issueCount = 0
): RuleResult {
  return {
    ruleId: rule.id,
    ruleCode: rule.code,
    status,
    severity: rule.severity,
    message,
    issueCount,
    details,
  };
}

export const outpatientDailyServiceRule:
  RuleValidator = {
  async evaluate(context, rule) {
    const xml1 = getXml1(context.xml1);

    if (!xml1) {
      return makeResult(
        rule,
        "SKIP",
        "Không đọc được XML1 để xác định loại KCB.",
        { reason: "XML1_UNAVAILABLE" }
      );
    }

    const maLoaiKcb = str(
      xml1.MA_LOAI_KCB
    ).padStart(2, "0");

    if (maLoaiKcb !== "02") {
      return makeResult(
        rule,
        "SKIP",
        `Rule chỉ áp dụng ngoại trú 02, hồ sơ hiện tại có mã ${maLoaiKcb || "trống"}.`,
        { maLoaiKcb }
      );
    }

    const maLk = str(xml1.MA_LK);
    const rawServices = getXml3Rows(context.xml3);

    if (rawServices.length === 0) {
      return makeResult(
        rule,
        "SKIP",
        "Không có danh sách DVKT XML3 để kiểm tra theo ngày.",
        {
          maLk,
          reason: "XML3_SERVICES_UNAVAILABLE",
        }
      );
    }

    const services: DailyService[] = [];
    const missingTime: Array<{
      stt: string;
      maDichVu: string;
      tenDichVu: string;
      ngayThYl: string;
      reason: string;
    }> = [];

    for (const item of rawServices) {
      const stt = str(item.STT);
      const maDichVu = str(item.MA_DICH_VU);
      const tenDichVu = str(item.TEN_DICH_VU);
      const ngayThucHien = str(item.NGAY_TH_YL);

      const ngayDieuTri = getDateKey(
        ngayThucHien
      );

      if (!ngayDieuTri) {
        missingTime.push({
          stt,
          maDichVu,
          tenDichVu,
          ngayThYl: ngayThucHien,
          reason: ngayThucHien
            ? "INVALID_PERFORM_TIME"
            : "MISSING_PERFORM_TIME",
        });
        continue;
      }

      services.push({
        stt,
        maDichVu,
        tenDichVu,
        maKhoa: str(item.MA_KHOA),
        ngayYLenh: str(item.NGAY_YL),
        ngayThucHien,
        ngayDieuTri,
        nguoiThucHien: str(
          item.NGUOI_THUC_HIEN
        ),
        soLuong: str(item.SO_LUONG),
      });
    }

    if (services.length === 0) {
      return makeResult(
        rule,
        "SKIP",
        "Không có DVKT nào có NGAY_TH_YL hợp lệ để thống kê theo ngày.",
        {
          maLk,
          totalServices: rawServices.length,
          missingTime,
        }
      );
    }

    // Nhóm dịch vụ theo ngày thực hiện.
    const dailyMap = new Map<
      string,
      DailyService[]
    >();

    for (const service of services) {
      const list =
        dailyMap.get(service.ngayDieuTri) ?? [];

      list.push(service);
      dailyMap.set(service.ngayDieuTri, list);
    }

    // Dấu hiệu dòng dữ liệu giống nhau:
    // mã DVKT + khoa + y lệnh + thực hiện
    // + người thực hiện + số lượng.
    //
    // Chỉ xét khi các trường cốt lõi có đủ.
    // Không coi đơn thuần cùng giờ là trùng.
    const duplicateMap = new Map<
      string,
      DailyService[]
    >();

    for (const service of services) {
      if (
        !service.maDichVu ||
        !service.ngayYLenh ||
        !service.ngayThucHien ||
        !service.nguoiThucHien ||
        !service.soLuong
      ) {
        continue;
      }

      const fingerprint = JSON.stringify([
        service.ngayDieuTri,
        service.maDichVu,
        service.maKhoa,
        service.ngayYLenh,
        service.ngayThucHien,
        service.nguoiThucHien,
        service.soLuong,
      ]);

      const list = duplicateMap.get(fingerprint) ?? [];

      list.push(service);
      duplicateMap.set(fingerprint, list);
    }

    const duplicates: DuplicateGroup[] = [];

    for (const group of duplicateMap.values()) {
      if (group.length < 2) continue;

      const first = group[0];

      duplicates.push({
        type: "POSSIBLE_DUPLICATE_SERVICE",
        ngayDieuTri: first.ngayDieuTri,
        maDichVu: first.maDichVu,
        tenDichVu: first.tenDichVu,
        stt: group.map((item) => item.stt),
        soDong: group.length,
        ngayYLenh: first.ngayYLenh,
        ngayThucHien: first.ngayThucHien,
        nguoiThucHien: first.nguoiThucHien,
        soLuongMoiDong: first.soLuong,
        message:
          `Có ${group.length} dòng DVKT giống nhau về mã, khoa, thời gian y lệnh/thực hiện, người thực hiện và số lượng. Cần đối chiếu hồ sơ gốc.`,
      });
    }

    // Tổng hợp chi tiết từng ngày.
    const dailySummary = Array.from(
      dailyMap.entries()
    )
      .sort(([dateA], [dateB]) =>
        dateA.localeCompare(dateB)
      )
      .map(([date, items]) => {
        const serviceGroups = new Map<
          string,
          {
            maDichVu: string;
            tenDichVu: string;
            soDong: number;
            stt: string[];
            thoiGianThucHien: string[];
          }
        >();

        for (const item of items) {
          const key = item.maDichVu ||
            `UNKNOWN_${item.stt}`;

          const existing = serviceGroups.get(key);

          if (existing) {
            existing.soDong++;
            existing.stt.push(item.stt);
            existing.thoiGianThucHien.push(
              item.ngayThucHien
            );
          } else {
            serviceGroups.set(key, {
              maDichVu: item.maDichVu,
              tenDichVu: item.tenDichVu,
              soDong: 1,
              stt: [item.stt],
              thoiGianThucHien: [
                item.ngayThucHien,
              ],
            });
          }
        }

        return {
          ngayDieuTri: date,
          tongSoDongDvkt: items.length,
          soMaDichVu: serviceGroups.size,
          dichVu: Array.from(
            serviceGroups.values()
          ),
        };
      });

    const details = {
      maLk,
      maLoaiKcb,
      ngayVao: str(xml1.NGAY_VAO),
      ngayRa: str(xml1.NGAY_RA),
      totalServices: rawServices.length,
      checkedServices: services.length,
      unclassifiedServices: missingTime.length,
      totalTreatmentDays: dailySummary.length,
      dailySummary,
      duplicates,
      missingTime,
    };

    if (duplicates.length > 0) {
      return makeResult(
        rule,
        "FAIL",
        `Phát hiện ${duplicates.length} nhóm DVKT có dữ liệu trùng bất thường, cần rà soát hồ sơ.`,
        details,
        duplicates.length
      );
    }

    if (missingTime.length > 0) {
      return makeResult(
        rule,
        "SKIP",
        `Đã thống kê ${services.length} DVKT theo ngày, nhưng còn ${missingTime.length} dòng thiếu hoặc sai NGAY_TH_YL nên chưa thể kiểm tra đầy đủ.`,
        details
      );
    }

    return makeResult(
      rule,
      "PASS",
      `Đã thống kê ${services.length} DVKT trong ${dailySummary.length} ngày có dịch vụ. Không phát hiện nhóm dữ liệu trùng theo tiêu chí rà soát.`,
      details
    );
  },
};
