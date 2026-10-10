export function parseDate(
  value: unknown
): Date | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? null
      : value;
  }

  const raw =
    String(value).trim();

  if (!raw) {
    return null;
  }

  // ==========================================
  // Dạng BHYT:
  //
  // 20261001
  // 202610010759
  // 20261001075930
  // ==========================================

  if (/^\d{8,14}$/.test(raw)) {
    const year =
      Number(raw.slice(0, 4));

    const month =
      Number(raw.slice(4, 6)) - 1;

    const day =
      Number(raw.slice(6, 8));

    const hour =
      raw.length >= 10
        ? Number(raw.slice(8, 10))
        : 0;

    const minute =
      raw.length >= 12
        ? Number(raw.slice(10, 12))
        : 0;

    const second =
      raw.length >= 14
        ? Number(raw.slice(12, 14))
        : 0;

    const date =
      new Date(
        year,
        month,
        day,
        hour,
        minute,
        second
      );

    return Number.isNaN(
      date.getTime()
    )
      ? null
      : date;
  }

  const date =
    new Date(raw);

  return Number.isNaN(
    date.getTime()
  )
    ? null
    : date;
}


export function formatDateTime(
  value: unknown
): string {
  const date =
    parseDate(value);

  if (!date) {
    return "";
  }

  const pad = (
    value: number
  ) =>
    String(value).padStart(
      2,
      "0"
    );

  return (
    `${pad(date.getDate())}/` +
    `${pad(date.getMonth() + 1)}/` +
    `${date.getFullYear()} ` +
    `${pad(date.getHours())}:` +
    `${pad(date.getMinutes())}`
  );
}


// ==========================================
// Tìm field sâu trong raw_data XML
// ==========================================

export function findRawValue(
  data: unknown,
  keys: string[]
): unknown {
  if (
    !data ||
    typeof data !== "object"
  ) {
    return null;
  }

  const normalizedKeys =
    keys.map(
      (key) =>
        key.toUpperCase()
    );


  for (
    const [key, value]
    of Object.entries(
      data as Record<
        string,
        unknown
      >
    )
  ) {
    if (
      normalizedKeys.includes(
        key.toUpperCase()
      )
    ) {
      if (
        value !== null &&
        value !== undefined &&
        String(value).trim() !== ""
      ) {
        return value;
      }
    }


    if (
      value &&
      typeof value === "object"
    ) {
      const found =
        findRawValue(
          value,
          normalizedKeys
        );

      if (
        found !== null &&
        found !== undefined
      ) {
        return found;
      }
    }
  }

  return null;
}


// ==========================================
// Chuẩn hóa 3 mốc thời gian
//
// Không yêu cầu database phải có:
//
// order_time
// perform_time
// result_time
//
// Ta đọc raw_data trước,
// sau đó fallback start_time/end_time.
// ==========================================

export function getEventTimes(
  event: any
) {
  const raw =
    event.raw_data ?? {};


  const orderTime =
    parseDate(
      findRawValue(
        raw,
        [
          "NGAY_YL",
          "NGAY_CHI_DINH",
        ]
      ) ??
      event.start_time
    );


  const performTime =
    parseDate(
      findRawValue(
        raw,
        [
          "NGAY_TH_YL",
          "NGAY_THUC_HIEN",
          "NGAY_THUC_HIEN_YL",
        ]
      ) ??
      event.end_time ??
      event.start_time
    );


  const resultTime =
    parseDate(
      findRawValue(
        raw,
        [
          "NGAY_KQ",
          "NGAY_KET_QUA",
        ]
      )
    );


  return {
    orderTime,
    performTime,
    resultTime,
  };
}