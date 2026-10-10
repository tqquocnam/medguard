type AnyObject =
  Record<string, any>;

export interface NormalizedEvent {
  sourceType:
    | "XML2"
    | "XML3";

  eventType:
    | "DRUG"
    | "SERVICE";

  maLk?: string;

  itemCode?: string;
  itemName?: string;

  doctorCode?: string;
  performerCode?: string;

  departmentCode?: string;

  startTime?: string | null;
  endTime?: string | null;

  rawData: AnyObject;
}

function toArray<T>(
  value?: T | T[]
): T[] {
  if (!value) {
    return [];
  }

  return Array.isArray(value)
    ? value
    : [value];
}

export function bhytDateTime(
  value?: string
): string | null {
  if (!value) {
    return null;
  }

  const raw =
    String(value).trim();

  if (raw.length < 8) {
    return null;
  }

  const year =
    raw.slice(0, 4);

  const month =
    raw.slice(4, 6);

  const day =
    raw.slice(6, 8);

  const hour =
    raw.length >= 10
      ? raw.slice(8, 10)
      : "00";

  const minute =
    raw.length >= 12
      ? raw.slice(10, 12)
      : "00";

  const second =
    raw.length >= 14
      ? raw.slice(12, 14)
      : "00";

  return (
    `${year}-${month}-${day} ` +
    `${hour}:${minute}:${second}`
  );
}

function normalizeXml2(
  data: AnyObject
): NormalizedEvent[] {
  const rows =
    toArray(
      data
        ?.CHITIEU_CHITIET_THUOC
        ?.DSACH_CHI_TIET_THUOC
        ?.CHI_TIET_THUOC
    );

  return rows.map(
    (row: AnyObject) => ({
      sourceType:
        "XML2",

      eventType:
        "DRUG",

      maLk:
        row.MA_LK,

      itemCode:
        row.MA_THUOC,

      itemName:
        row.TEN_THUOC,

      doctorCode:
        row.MA_BAC_SI,

      performerCode:
        row.MA_BAC_SI,

      departmentCode:
        row.MA_KHOA,

      startTime:
        bhytDateTime(
          row.NGAY_YL
        ),

      endTime:
        bhytDateTime(
          row.NGAY_TH_YL ||
          row.NGAY_YL
        ),

      rawData:
        row,
    })
  );
}

function normalizeXml3(
  data: AnyObject
): NormalizedEvent[] {
  const rows =
    toArray(
      data
        ?.CHITIEU_CHITIET_DVKT_VTYT
        ?.DSACH_CHI_TIET_DVKT
        ?.CHI_TIET_DVKT
    );

  return rows.map(
    (row: AnyObject) => ({
      sourceType:
        "XML3",

      eventType:
        "SERVICE",

      maLk:
        row.MA_LK,

      itemCode:
        row.MA_DICH_VU,

      itemName:
        row.TEN_DICH_VU,

      doctorCode:
        row.MA_BAC_SI,

      performerCode:
        row.NGUOI_THUC_HIEN,

      departmentCode:
        row.MA_KHOA,

      startTime:
        bhytDateTime(
          row.NGAY_YL
        ),

      endTime:
        bhytDateTime(
          row.NGAY_TH_YL ||
          row.NGAY_YL
        ),

      rawData:
        row,
    })
  );
}

export function normalizeXmlFile(
  xmlType: string,
  parsedData: AnyObject
): NormalizedEvent[] {
  switch (xmlType) {
    case "XML2":
      return normalizeXml2(
        parsedData
      );

    case "XML3":
      return normalizeXml3(
        parsedData
      );

    default:
      return [];
  }
}