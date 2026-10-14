
import type {
  RuleResult,
  RuleValidator,
  ValidationRule,
} from "../rule.types.js";

type JsonObject = Record<string, unknown>;

interface Finding {
  type: string;
  stt?: string;
  date?: string;
  value?: string;
  message: string;
}

function isObject(value: unknown): value is JsonObject {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function text(value: unknown): string {
  return value === null || value === undefined
    ? ""
    : String(value).trim();
}

function firstObject(value: unknown): JsonObject | null {
  const selected = Array.isArray(value)
    ? value[0]
    : value;

  return isObject(selected) ? selected : null;
}

function getXml1(xml1: unknown): JsonObject | null {
  return firstObject(
    firstObject(xml1)?.TONG_HOP
  );
}

function getXml5Rows(xml5: unknown): JsonObject[] {
  const root = firstObject(xml5);

  const section = firstObject(
    root?.CHITIEU_CHITIET_DIENBIENLAMSANG
  );

  const list = firstObject(
    section?.DSACH_CHI_TIET_DIEN_BIEN_BENH
  );

  const data = list?.CHI_TIET_DIEN_BIEN_BENH;

  if (data === null || data === undefined) {
    return [];
  }

  const rows = Array.isArray(data) ? data : [data];

  return rows.filter(isObject);
}

function getXml3Rows(xml3: unknown): JsonObject[] {
  const root = firstObject(xml3);

  const section = firstObject(
    root?.CHITIEU_CHITIET_DVKT_VTYT
  );

  const list = firstObject(
    section?.DSACH_CHI_TIET_DVKT
  );

  const data = list?.CHI_TIET_DVKT;

  if (data === null || data === undefined) {
    return [];
  }

  const rows = Array.isArray(data) ? data : [data];

  return rows.filter(isObject);
}

function parseXmlTime(value: unknown): {
  timestamp: number;
  date: string;
} | null {
  const raw = text(value);

  if (!/^\d{12}(\d{2})?$/.test(raw)) {
    return null;
  }

  const year = Number(raw.slice(0, 4));
  const month = Number(raw.slice(4, 6));
  const day = Number(raw.slice(6, 8));
  const hour = Number(raw.slice(8, 10));
  const minute = Number(raw.slice(10, 12));
  const second =
    raw.length === 14
      ? Number(raw.slice(12, 14))
      : 0;

  const timestamp = Date.UTC(
    year,
    month - 1,
    day,
    hour,
    minute,
    second
  );

  const date = new Date(timestamp);

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

  return {
    timestamp,
    date: [
      String(year).padStart(4, "0"),
      String(month).padStart(2, "0"),
      String(day).padStart(2, "0"),
    ].join("-"),
  };
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

export const outpatientClinicalProgressRule:
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

    const maLoaiKcb = text(
      xml1.MA_LOAI_KCB
    ).padStart(2, "0");

    if (maLoaiKcb !== "02") {
      return makeResult(
        rule,
        "SKIP",
        `Rule chỉ áp dụng điều trị ngoại trú 02. Mã hiện tại: ${maLoaiKcb || "trống"}.`,
        { maLoaiKcb }
      );
    }

    const maLk = text(xml1.MA_LK);
    const ngayVao = text(xml1.NGAY_VAO);
    const ngayRa = text(xml1.NGAY_RA);

    const start = parseXmlTime(ngayVao);
    const end = parseXmlTime(ngayRa);

    if (!start || !end || end.timestamp < start.timestamp) {
      return makeResult(
        rule,
        "SKIP",
        "Không đủ thông tin ngày vào/ra hợp lệ để đối chiếu XML5.",
        {
          maLk,
          ngayVao,
          ngayRa,
          reason: "INVALID_TREATMENT_PERIOD",
        }
      );
    }

    const rows = getXml5Rows(context.xml5);

    if (rows.length === 0) {
      return makeResult(
        rule,
        "SKIP",
        "Hồ sơ không có dữ liệu diễn biến XML5 để đối chiếu.",
        {
          maLk,
          reason: "XML5_UNAVAILABLE",
        }
      );
    }

    const findings: Finding[] = [];

    const clinicalDays = new Map<
      string,
      {
        date: string;
        count: number;
        stt: string[];
        performers: string[];
        hasClinicalText: boolean;
      }
    >();

    let checkedRows = 0;

    for (const row of rows) {
      const stt = text(row.STT);
      const rawTime = text(row.THOI_DIEM_DBLS);

      const parsed = parseXmlTime(rawTime);

      if (!parsed) {
        findings.push({
          type: "INVALID_CLINICAL_TIME",
          stt,
          value: rawTime,
          message: rawTime
            ? "THOI_DIEM_DBLS không hợp lệ."
            : "Thiếu THOI_DIEM_DBLS.",
        });

        continue;
      }

      checkedRows++;

      if (
        parsed.timestamp < start.timestamp ||
        parsed.timestamp > end.timestamp
      ) {
        findings.push({
          type: "CLINICAL_OUTSIDE_TREATMENT",
          stt,
          date: parsed.date,
          value: rawTime,
          message:
            "Diễn biến lâm sàng nằm ngoài khoảng ngày vào/ra điều trị.",
        });
      }

      const existing = clinicalDays.get(parsed.date);

      if (existing) {
        existing.count++;
        existing.stt.push(stt);

        const performer = text(row.NGUOI_THUC_HIEN);

        if (
          performer &&
          !existing.performers.includes(performer)
        ) {
          existing.performers.push(performer);
        }

        if (text(row.DIEN_BIEN_LS)) {
          existing.hasClinicalText = true;
        }
      } else {
        const performer = text(row.NGUOI_THUC_HIEN);

        clinicalDays.set(parsed.date, {
          date: parsed.date,
          count: 1,
          stt: [stt],
          performers: performer ? [performer] : [],
          hasClinicalText: Boolean(
            text(row.DIEN_BIEN_LS)
          ),
        });
      }
    }

    // Lấy ngày thực hiện DVKT XML3.
    const xml3Rows = getXml3Rows(context.xml3);

    const serviceDays = new Map<
      string,
      {
        date: string;
        count: number;
        services: Array<{
          stt: string;
          maDichVu: string;
          tenDichVu: string;
        }>;
      }
    >();

    let invalidServiceTimes = 0;

    for (const row of xml3Rows) {
      const rawTime = text(row.NGAY_TH_YL);
      const parsed = parseXmlTime(rawTime);

      if (!parsed) {
        invalidServiceTimes++;
        continue;
      }

      const service = {
        stt: text(row.STT),
        maDichVu: text(row.MA_DICH_VU),
        tenDichVu: text(row.TEN_DICH_VU),
      };

      const existing = serviceDays.get(parsed.date);

      if (existing) {
        existing.count++;
        existing.services.push(service);
      } else {
        serviceDays.set(parsed.date, {
          date: parsed.date,
          count: 1,
          services: [service],
        });
      }
    }

    // Đối chiếu ngày có DVKT với ngày có XML5.
    // Đây chỉ là dấu hiệu cần rà soát.
    // Không mặc định thiếu XML5 cùng ngày là sai BHYT.
    const daysWithoutClinicalProgress = Array.from(
      serviceDays.values()
    )
      .filter((item) => !clinicalDays.has(item.date))
      .sort((a, b) => a.date.localeCompare(b.date));

    const dailySummary = Array.from(
      new Set([
        ...clinicalDays.keys(),
        ...serviceDays.keys(),
      ])
    )
      .sort()
      .map((date) => {
        const clinical = clinicalDays.get(date);
        const services = serviceDays.get(date);

        return {
          date,
          clinicalEntries: clinical?.count ?? 0,
          serviceEntries: services?.count ?? 0,
          hasClinicalText:
            clinical?.hasClinicalText ?? false,
          clinicalStt: clinical?.stt ?? [],
          clinicalPerformers:
            clinical?.performers ?? [],
          services: services?.services ?? [],
        };
      });

    const details = {
      maLk,
      maLoaiKcb,
      ngayVao,
      ngayRa,
      totalClinicalEntries: rows.length,
      checkedClinicalEntries: checkedRows,
      totalServiceEntries: xml3Rows.length,
      invalidServiceTimes,
      clinicalDayCount: clinicalDays.size,
      serviceDayCount: serviceDays.size,
      dailySummary,
      daysWithoutClinicalProgress,
      findings,
    };

    if (findings.length > 0) {
      return makeResult(
        rule,
        "FAIL",
        `Phát hiện ${findings.length} mốc diễn biến XML5 thiếu, sai định dạng hoặc nằm ngoài đợt điều trị.`,
        details,
        findings.length
      );
    }

    if (checkedRows === 0) {
      return makeResult(
        rule,
        "SKIP",
        "Không có mốc diễn biến XML5 hợp lệ để kiểm tra.",
        details
      );
    }

   // Không kết luận FAIL chỉ vì thiếu XML5 cùng ngày.
// Danh sách này vẫn nằm trong details để rà soát.
if (daysWithoutClinicalProgress.length > 0) {
  return makeResult(
    rule,
    "PASS",
    `Đã đối chiếu XML5. Có ${daysWithoutClinicalProgress.length} ngày thực hiện DVKT không tìm thấy diễn biến cùng ngày; thông tin được lưu để rà soát, không mặc định là lỗi.`,
    details,
    0
  );
}

    if (invalidServiceTimes > 0) {
      return makeResult(
        rule,
        "SKIP",
        `Đã kiểm tra XML5 nhưng còn ${invalidServiceTimes} dòng XML3 thiếu/sai thời gian thực hiện, chưa thể đối chiếu đầy đủ.`,
        details
      );
    }

    return makeResult(
      rule,
      "PASS",
      `Đã kiểm tra ${checkedRows} dòng diễn biến XML5 trên ${clinicalDays.size} ngày, đối chiếu ${serviceDays.size} ngày có DVKT. Chưa phát hiện bất thường theo các tiêu chí hiện tại.`,
      details
    );
  },
};
