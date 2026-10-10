export interface ImportValidationError {
  code: string;
  message: string;
}

export interface ImportCaseValidation {
  index: number;

  maLk:
    string | null;

  maBn:
    string | null;

  hoTen:
    string | null;

  valid: boolean;

  errors:
    ImportValidationError[];
}


// ============================================
// PARSE THỜI GIAN BHYT
//
// 20261004
// 202610040840
// 20261004084030
// ============================================

function parseBhytTime(
  value: unknown
): Date | null {

  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }


  const raw =
    String(
      value
    )
      .trim()
      .replace(
        /\D/g,
        ""
      );


  if (
    raw.length !== 8 &&
    raw.length !== 12 &&
    raw.length !== 14
  ) {
    return null;
  }


  const year =
    Number(
      raw.slice(
        0,
        4
      )
    );

  const month =
    Number(
      raw.slice(
        4,
        6
      )
    );

  const day =
    Number(
      raw.slice(
        6,
        8
      )
    );

  const hour =
    raw.length >= 12
      ? Number(
          raw.slice(
            8,
            10
          )
        )
      : 0;

  const minute =
    raw.length >= 12
      ? Number(
          raw.slice(
            10,
            12
          )
        )
      : 0;

  const second =
    raw.length >= 14
      ? Number(
          raw.slice(
            12,
            14
          )
        )
      : 0;


  const result =
    new Date(
      year,
      month - 1,
      day,
      hour,
      minute,
      second
    );


  if (
    Number.isNaN(
      result.getTime()
    )
  ) {
    return null;
  }


  return result;
}


// ============================================
// FORMAT
// ============================================

function formatTime(
  value: unknown
): string {

  const date =
    parseBhytTime(
      value
    );


  if (!date) {
    return String(
      value ??
      ""
    );
  }


  const pad =
    (
      number: number
    ) =>
      String(
        number
      ).padStart(
        2,
        "0"
      );


  return (
    `${pad(
      date.getDate()
    )}/` +

    `${pad(
      date.getMonth() + 1
    )}/` +

    `${date.getFullYear()} ` +

    `${pad(
      date.getHours()
    )}:` +

    `${pad(
      date.getMinutes()
    )}`
  );
}


// ============================================
// DUYỆT TOÀN BỘ JSON
// ============================================

function collectObjects(
  data: unknown,

  result:
    Record<
      string,
      any
    >[] = []
) {

  if (
    data === null ||
    data === undefined
  ) {
    return result;
  }


  if (
    Array.isArray(
      data
    )
  ) {

    for (
      const item
      of data
    ) {
      collectObjects(
        item,
        result
      );
    }

    return result;
  }


  if (
    typeof data !==
    "object"
  ) {
    return result;
  }


  const object =
    data as Record<
      string,
      any
    >;


  result.push(
    object
  );


  for (
    const value
    of Object.values(
      object
    )
  ) {

    collectObjects(
      value,
      result
    );
  }


  return result;
}


// ============================================
// KIỂM TRA THỜI GIAN Y LỆNH
// ============================================

function checkOrderTimes(
  medicalCase: any
): ImportValidationError[] {

  const errors:
    ImportValidationError[] =
    [];


  for (
    const file
    of medicalCase.files ??
    []
  ) {

    const xmlType =
      String(
        file.type ??
        ""
      ).toUpperCase();


    if (
      xmlType !== "XML2" &&
      xmlType !== "XML3"
    ) {
      continue;
    }


    const objects =
      collectObjects(
        file.data
      );


    for (
      const row
      of objects
    ) {

      const ngayYl =
        row.NGAY_YL ??
        row.NGAY_CHI_DINH;


      const ngayThYl =
        row.NGAY_TH_YL ??
        row.NGAY_THUC_HIEN_YL ??
        row.NGAY_THUC_HIEN;


      if (
        !ngayYl ||
        !ngayThYl
      ) {
        continue;
      }


      const orderTime =
        parseBhytTime(
          ngayYl
        );


      const performTime =
        parseBhytTime(
          ngayThYl
        );


      if (
        !orderTime ||
        !performTime
      ) {

        errors.push({
          code:
            "INVALID_ORDER_TIME",

          message:
            `${
              row.TEN_DICH_VU ??
              row.TEN_THUOC ??
              row.MA_DICH_VU ??
              row.MA_THUOC ??
              "Y lệnh"
            }: thời gian y lệnh hoặc thời gian thực hiện không hợp lệ.`,
        });


        continue;
      }


      // ========================================
      // THỰC HIỆN KHÔNG ĐƯỢC TRƯỚC Y LỆNH
      //
      // NGAY_YL = 08:40
      // NGAY_TH_YL = 08:45
      // => ĐÚNG
      //
      // NGAY_YL = 08:40
      // NGAY_TH_YL = 08:35
      // => LỖI
      // ========================================

      if (
        performTime.getTime() <
        orderTime.getTime()
      ) {

        errors.push({
          code:
            "PERFORM_BEFORE_ORDER",

          message:
            `${
              row.TEN_DICH_VU ??
              row.TEN_THUOC ??
              row.MA_DICH_VU ??
              row.MA_THUOC ??
              "Y lệnh"
            }: thời gian thực hiện ` +

            `${formatTime(
              ngayThYl
            )} trước thời gian y lệnh ` +

            `${formatTime(
              ngayYl
            )}.`,
        });
      }
    }
  }


  return errors;
}


// ============================================
// VALIDATE TOÀN BỘ FILE
// ============================================

export function validateImportFile(
  parsed: any
) {

  const results:
    ImportCaseValidation[] =
    [];


  const cases =
    parsed.cases ??
    [];


  for (
    let index = 0;
    index <
    cases.length;
    index++
  ) {

    const medicalCase =
      cases[index];


    const errors:
      ImportValidationError[] =
      [];


    const xml1 =
      (
        medicalCase.files ??
        []
      ).find(
        (
          file: any
        ) =>
          String(
            file.type ??
            ""
          ).toUpperCase() ===
          "XML1"
      );


    // ========================================
    // XML1
    // ========================================

    if (!xml1) {

      errors.push({
        code:
          "MISSING_XML1",

        message:
          "Hồ sơ không có XML1.",
      });
    }


    const tongHop =
      xml1?.data
        ?.TONG_HOP ??
      {};


    const maLk =
      tongHop.MA_LK ??
      medicalCase.maLk ??
      null;


    const maBn =
      tongHop.MA_BN ??
      medicalCase.maBn ??
      null;


    const hoTen =
      tongHop.HO_TEN ??
      medicalCase.hoTen ??
      null;


    // ========================================
    // MA_LK
    // ========================================

    if (
      !String(
        maLk ??
        ""
      ).trim()
    ) {

      errors.push({
        code:
          "MISSING_MA_LK",

        message:
          "Thiếu mã liên kết MA_LK.",
      });
    }


    // ========================================
    // NGÀY VÀO / NGÀY RA
    // ========================================

    const ngayVao =
      tongHop.NGAY_VAO ??
      medicalCase.ngayVao;


    const ngayRa =
      tongHop.NGAY_RA ??
      medicalCase.ngayRa;


    const start =
      ngayVao
        ? parseBhytTime(
            ngayVao
          )
        : null;


    const end =
      ngayRa
        ? parseBhytTime(
            ngayRa
          )
        : null;


    if (
      ngayVao &&
      !start
    ) {

      errors.push({
        code:
          "INVALID_NGAY_VAO",

        message:
          "NGAY_VAO không đúng định dạng.",
      });
    }


    if (
      ngayRa &&
      !end
    ) {

      errors.push({
        code:
          "INVALID_NGAY_RA",

        message:
          "NGAY_RA không đúng định dạng.",
      });
    }


    if (
      start &&
      end &&
      end.getTime() <
        start.getTime()
    ) {

      errors.push({
        code:
          "INVALID_VISIT_TIME",

        message:
          "Thời gian ra viện nhỏ hơn thời gian vào viện.",
      });
    }


    // ========================================
    // Y LỆNH
    // ========================================

    errors.push(
      ...checkOrderTimes(
        medicalCase
      )
    );


    results.push({
      index:
        medicalCase.index ??
        index + 1,

      maLk:
        maLk
          ? String(
              maLk
            )
          : null,

      maBn:
        maBn
          ? String(
              maBn
            )
          : null,

      hoTen:
        hoTen
          ? String(
              hoTen
            )
          : null,

      valid:
        errors.length ===
        0,

      errors,
    });
  }


  const invalidCases =
    results.filter(
      (
        item
      ) =>
        !item.valid
    );


  const validCases =
    results.filter(
      (
        item
      ) =>
        item.valid
    );


  return {

    // ========================================
    // QUAN TRỌNG NHẤT
    //
    // Chỉ cần một ca lỗi:
    // canImport = false
    // ========================================

    canImport:
      invalidCases.length ===
      0,


    summary: {

      total:
        results.length,

      valid:
        validCases.length,

      invalid:
        invalidCases.length,
    },


    cases:
      results,
  };
}