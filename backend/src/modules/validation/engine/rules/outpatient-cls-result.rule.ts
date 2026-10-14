
import type {
  RuleResult,
  RuleValidator,
  ValidationRule,
} from "../rule.types.js";

type JsonObject = Record<string, unknown>;

interface XmlTime {
  value: number;
  day: string;
}

interface Service {
  stt: string;
  code: string;
  name: string;
  orderTime: XmlTime | null;
  performTime: XmlTime | null;
  orderRaw: string;
  performRaw: string;
}

interface Finding {
  type: string;
  stt: string;
  maDichVu: string;
  ngayKq: string;
  message: string;
}

function isObject(value: unknown): value is JsonObject {
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

function firstObject(value: unknown): JsonObject | null {
  const first = Array.isArray(value) ? value[0] : value;
  return isObject(first) ? first : null;
}

function getRows(
  xml: unknown,
  sectionName: string,
  listName: string,
  rowName: string
): JsonObject[] {
  const root = firstObject(xml);
  const section = firstObject(root?.[sectionName]);
  const list = firstObject(section?.[listName]);
  const raw = list?.[rowName];

  if (!raw) return [];

  return (Array.isArray(raw) ? raw : [raw])
    .filter(isObject);
}

function getXml1(xml: unknown): JsonObject | null {
  return firstObject(firstObject(xml)?.TONG_HOP);
}

function getXml3(xml: unknown): JsonObject[] {
  return getRows(
    xml,
    "CHITIEU_CHITIET_DVKT_VTYT",
    "DSACH_CHI_TIET_DVKT",
    "CHI_TIET_DVKT"
  );
}

function getXml4(xml: unknown): JsonObject[] {
  return getRows(
    xml,
    "CHITIEU_CHITIET_DICHVUCANLAMSANG",
    "DSACH_CHI_TIET_CLS",
    "CHI_TIET_CLS"
  );
}


function parseTime(input: unknown): XmlTime | null {
  const raw = str(input);

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

  // Chỉ sử dụng UTC để tạo giá trị
  // so sánh các mốc thời gian XML.
  const timestamp = Date.UTC(
    year,
    month - 1,
    day,
    hour,
    minute,
    second
  );

  const date = new Date(timestamp);

  // Kiểm tra ngày giờ hợp lệ.
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
    value: timestamp,
    day: [
      String(year).padStart(4, "0"),
      String(month).padStart(2, "0"),
      String(day).padStart(2, "0"),
    ].join("-"),
  };
}

function createResult(
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
    issueCount,
    message,
    details,
  };
}

export const outpatientClsResultRule: RuleValidator = {
  async evaluate(context, rule) {
    const xml1 = getXml1(context.xml1);

    if (!xml1) {
      return createResult(
        rule,
        "SKIP",
        "Không đọc được XML1 để xác định loại KCB.",
        { reason: "XML1_UNAVAILABLE" }
      );
    }

    const maLoaiKcb = str(xml1.MA_LOAI_KCB)
      .padStart(2, "0");

    if (maLoaiKcb !== "02") {
      return createResult(
        rule,
        "SKIP",
        `Rule chỉ áp dụng điều trị ngoại trú 02. Hồ sơ có mã ${maLoaiKcb}.`,
        { maLoaiKcb }
      );
    }

    const maLk = str(xml1.MA_LK);
    const visitStart = parseTime(xml1.NGAY_VAO);
    const visitEnd = parseTime(xml1.NGAY_RA);

    const xml3Rows = getXml3(context.xml3);
    const xml4Rows = getXml4(context.xml4);

    if (xml4Rows.length === 0) {
      return createResult(
        rule,
        "SKIP",
        "Không có dòng XML4 để đối chiếu.",
        {
          maLk,
          reason: "XML4_UNAVAILABLE",
        }
      );
    }

    if (xml3Rows.length === 0) {
      return createResult(
        rule,
        "SKIP",
        "Có XML4 nhưng không có dữ liệu XML3 để đối chiếu.",
        {
          maLk,
          totalXml4Rows: xml4Rows.length,
          reason: "XML3_UNAVAILABLE",
        }
      );
    }

    const services: Service[] = xml3Rows.map((row) => ({
      stt: str(row.STT),
      code: str(row.MA_DICH_VU).toUpperCase(),
      name: str(row.TEN_DICH_VU),
      orderTime: parseTime(row.NGAY_YL),
      performTime: parseTime(row.NGAY_TH_YL),
      orderRaw: str(row.NGAY_YL),
      performRaw: str(row.NGAY_TH_YL),
    }));

    const servicesByCode = new Map<string, Service[]>();

    for (const service of services) {
      if (!service.code) continue;

      const group = servicesByCode.get(service.code) ?? [];
      group.push(service);
      servicesByCode.set(service.code, group);
    }

    const findings: Finding[] = [];

    const matches: Array<{
      xml4Stt: string;
      xml3Stt: string;
      maDichVu: string;
      ngayThYl: string;
      ngayKq: string;
      matchType: string;
    }> = [];

    const unmatchedResults: Array<{
      stt: string;
      maDichVu: string;
      ngayKq: string;
      reason: string;
    }> = [];

    const usedServices = new Set<Service>();

    let validResultTimes = 0;

    // Xử lý theo thời gian kết quả để ưu tiên
    // ghép mỗi lần thực hiện với một kết quả.
    const results = xml4Rows.map((row) => ({
      stt: str(row.STT),
      code: str(row.MA_DICH_VU).toUpperCase(),
      rawTime: str(row.NGAY_KQ),
      time: parseTime(row.NGAY_KQ),
    }));

    results.sort(
      (a, b) =>
        (a.time?.value ?? Number.MAX_SAFE_INTEGER) -
        (b.time?.value ?? Number.MAX_SAFE_INTEGER)
    );

    for (const result of results) {
      if (!result.time) {
        findings.push({
          type: "INVALID_XML4_RESULT_TIME",
          stt: result.stt,
          maDichVu: result.code,
          ngayKq: result.rawTime,
          message: result.rawTime
            ? "NGAY_KQ trong XML4 sai định dạng."
            : "XML4 thiếu NGAY_KQ.",
        });
        continue;
      }

      validResultTimes++;

      if (
        visitStart &&
        visitEnd &&
        visitEnd.value >= visitStart.value &&
        (
          result.time.value < visitStart.value ||
          result.time.value > visitEnd.value
        )
      ) {
        findings.push({
          type: "XML4_RESULT_OUTSIDE_VISIT",
          stt: result.stt,
          maDichVu: result.code,
          ngayKq: result.rawTime,
          message:
            "Thời gian kết quả XML4 nằm ngoài khoảng vào/ra điều trị; cần kiểm tra quy trình trả kết quả.",
        });
      }

      if (!result.code) {
        findings.push({
          type: "XML4_MISSING_SERVICE_CODE",
          stt: result.stt,
          maDichVu: "",
          ngayKq: result.rawTime,
          message: "XML4 thiếu MA_DICH_VU.",
        });
        continue;
      }

      const candidates =
        servicesByCode.get(result.code) ?? [];

      if (candidates.length === 0) {
        findings.push({
          type: "XML4_SERVICE_NOT_FOUND",
          stt: result.stt,
          maDichVu: result.code,
          ngayKq: result.rawTime,
          message:
            "Không tìm thấy mã DVKT tương ứng trong XML3.",
        });
        continue;
      }

      // Một kết quả có thể đi sau thời gian
      // thực hiện, kể cả trả kết quả khác ngày.
      const eligible = candidates.filter(
        (service) =>
          !usedServices.has(service) &&
          service.performTime !== null &&
          service.performTime.value <= result.time!.value
      );

      // Ưu tiên lần thực hiện cùng ngày;
      // nếu không có thì dùng lần gần nhất
      // trước thời gian kết quả.
      eligible.sort((a, b) => {
        const aSameDay =
          a.performTime!.day === result.time!.day ? 1 : 0;
        const bSameDay =
          b.performTime!.day === result.time!.day ? 1 : 0;

        if (aSameDay !== bSameDay) {
          return bSameDay - aSameDay;
        }

        return (
          b.performTime!.value -
          a.performTime!.value
        );
      });

      const matched = eligible[0];

      if (matched) {
        usedServices.add(matched);

        matches.push({
          xml4Stt: result.stt,
          xml3Stt: matched.stt,
          maDichVu: result.code,
          ngayThYl: matched.performRaw,
          ngayKq: result.rawTime,
          matchType:
            matched.performTime!.day === result.time.day
              ? "SAME_DAY"
              : "PREVIOUS_DAY",
        });

        continue;
      }

      const performedCandidates = candidates.filter(
        (service) => service.performTime !== null
      );

      const allPerformAfterResult =
        performedCandidates.length > 0 &&
        performedCandidates.every(
          (service) =>
            service.performTime!.value > result.time!.value
        );

      if (allPerformAfterResult) {
        findings.push({
          type: "RESULT_BEFORE_ALL_PERFORMANCES",
          stt: result.stt,
          maDichVu: result.code,
          ngayKq: result.rawTime,
          message:
            "Kết quả XML4 sớm hơn tất cả mốc thực hiện tìm thấy của mã DVKT này trong XML3.",
        });
      } else {
        // Có thể là nhiều kết quả/chỉ số thuộc
        // cùng một lần thực hiện hoặc thiếu
        // dữ liệu thời gian để ghép chính xác.
        unmatchedResults.push({
          stt: result.stt,
          maDichVu: result.code,
          ngayKq: result.rawTime,
          reason: performedCandidates.length === 0
            ? "NO_VALID_PERFORM_TIME"
            : "NO_UNIQUE_MATCH",
        });
      }
    }

    const details: Record<string, unknown> = {
      maLk,
      maLoaiKcb,
      ngayVao: str(xml1.NGAY_VAO),
      ngayRa: str(xml1.NGAY_RA),
      totalXml3Rows: xml3Rows.length,
      totalXml4Rows: xml4Rows.length,
      validResultTimes,
      matchedResults: matches.length,
      matches,
      unmatchedResults,
      findings,
      matchingNote:
        "Ghép theo MA_DICH_VU và thời gian; không có mã định danh riêng từng lần thực hiện. Kết quả ghép chỉ mang tính đối chiếu dữ liệu.",
    };

    if (findings.length > 0) {
      return createResult(
        rule,
        "FAIL",
        `Phát hiện ${findings.length} bất thường XML4 cần rà soát.`,
        details,
        findings.length
      );
    }

    if (validResultTimes === 0) {
      return createResult(
        rule,
        "SKIP",
        "Không có thời gian kết quả XML4 hợp lệ để đối chiếu.",
        details
      );
    }

    if (unmatchedResults.length > 0) {
      return createResult(
        rule,
        "PASS",
        `Đã kiểm tra XML4. Ghép được ${matches.length}/${xml4Rows.length} dòng; ${unmatchedResults.length} dòng chưa ghép chắc chắn, đã lưu chi tiết để rà soát.`,
        details
      );
    }

    return createResult(
      rule,
      "PASS",
      `Đã đối chiếu ${matches.length}/${xml4Rows.length} dòng XML4 với XML3. Không phát hiện bất thường theo tiêu chí hiện tại.`,
      details
    );
  },
};
