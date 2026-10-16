import type {
  RuleValidator,
} from "../rule.types.js";


// ======================================================
// TYPES
// ======================================================

interface DrugIngredientRow {
  drug_code: string;

  active_ingredient: string;

  active_ingredient_code:
    string |
    null;
}


interface InteractionRow {
  ingredient_a: string;

  ingredient_b: string;

  severity: string;

  description:
    string |
    null;
}


// ======================================================
// HELPERS
// ======================================================

function normalize(
  value: unknown
): string {

  return String(
    value ??
    ""
  )
    .normalize(
      "NFD"
    )
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .replace(
      /đ/g,
      "d"
    )
    .replace(
      /Đ/g,
      "D"
    )
    .toLowerCase()
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}


function normalizeText(
  value: unknown
): string {

  return String(
    value ??
    ""
  ).trim();
}


function normalizeCode(
  value: unknown
): string {

  return normalizeText(
    value
  ).toLowerCase();
}


// ======================================================
// GET DRUG CODE
//
// Ưu tiên event.item_code.
// Nếu không có thì lấy raw_data.MA_THUOC.
// ======================================================

function getDrugCode(
  event: any
): string {

  const raw =
    event?.raw_data ??
    {};


  return (
    normalizeText(
      event?.item_code
    ) ||
    normalizeText(
      raw?.MA_THUOC
    )
  );
}


// ======================================================
// GET DRUG NAME
// ======================================================

function getDrugName(
  event: any
): string {

  const raw =
    event?.raw_data ??
    {};


  return (
    normalizeText(
      event?.item_name
    ) ||
    normalizeText(
      raw?.TEN_THUOC
    )
  );
}


// ======================================================
// NHAN DIEN CAC DONG TACH SO LUONG CUA CUNG MOT LIEU TRINH
// Bao thu khi thieu bat ky du lieu xac minh nao.
// ======================================================

function parseDrugQuantity(value: unknown): number | null {
  const text = normalizeText(value).replace(/\s/g, "");
  if (!/^\d+(?:[.,]\d+)?$/.test(text)) return null;
  const amount = Number(text.replace(",", "."));
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function expectedCourseQuantity(dosage: unknown): number | null {
  // Vi du: "1 Vien/lan * 2 lan/ngay * 7 ngay [2 Vien/ngay]"
  const text = normalize(dosage);
  const match = text.match(
    /(\d+(?:[.,]\d+)?)\s*[^*\n]{0,35}\/lan\s*\*\s*(\d+(?:[.,]\d+)?)\s*lan\/ngay\s*\*\s*(\d+(?:[.,]\d+)?)\s*ngay/
  );
  if (!match) return null;
  const doses = match.slice(1, 4).map(v => Number(v.replace(",", ".")));
  if (doses.some(v => !Number.isFinite(v) || v <= 0)) return null;
  return doses[0] * doses[1] * doses[2];
}

function isSplitDispensingOfOneCourse(items: any[]): boolean {
  if (items.length < 2) return false;
  const first = items[0]?.raw_data ?? {};
  // Khong suy dien tu thuoc cung ma ma thieu NGAY_YL/khoa/bac si/lieu.
  const signatureKeys = ["NGAY_YL", "MA_KHOA", "LIEU_DUNG"];
  if (signatureKeys.some(k => !normalizeText(first[k]))) return false;
  const firstDoctor = normalizeCode(items[0]?.doctor_code || first.MA_BAC_SI);
  if (!firstDoctor) return false;
  const expected = expectedCourseQuantity(first.LIEU_DUNG);
  if (expected === null) return false;

  let total = 0;
  for (const item of items) {
    const raw = item?.raw_data ?? {};
    const doctor = normalizeCode(item?.doctor_code || raw.MA_BAC_SI);
    if (doctor !== firstDoctor) return false;
    if (signatureKeys.some(k => normalize(raw[k]) !== normalize(first[k]))) return false;
    // Neu ca hai dong co NGAY_TH_YL, yeu cau cung gio thuc hien.
    if (normalizeText(raw.NGAY_TH_YL) !== normalizeText(first.NGAY_TH_YL)) return false;
    const amount = parseDrugQuantity(raw.SO_LUONG);
    if (amount === null || amount >= expected) return false;
    total += amount;
  }
  // Tong khoi luong bang DUNG mot lieu trinh, khong du ra hai lieu trinh.
  return Math.abs(total - expected) < 1e-6;
}


// ======================================================
// DRUG INTERACTION RULE
//
// Trách nhiệm:
//
// DRUG_EXISTS:
// - thuốc không tồn tại
// - thuốc inactive
//
// DRUG_INTERACTION:
// - chỉ kiểm tra thuốc tồn tại + active
//
// Kiểm tra:
// 1. Trùng mã thuốc
// 2. Trùng hoạt chất
// 3. Tương tác hoạt chất
//
// ======================================================

export const drugInteractionRule:
  RuleValidator = {

  async evaluate(
    context,
    rule,
    runtime
  ) {

    const client =
      runtime.client;


    const config =
      rule.config ??
      {};


    const checkDuplicateDrug =
      config.checkDuplicateDrugCode !==
      false;


    const checkDuplicateIngredient =
      config.checkDuplicateIngredient !==
      false;


    const checkInteractions =
      config.checkInteractions !==
      false;


    // ==================================================
    // 1. LẤY THUỐC XML2
    // ==================================================

    const allDrugs =
      (
        context.events ??
        []
      ).filter(
        (
          event
        ) => {

          const sourceType =
            normalizeText(
              event?.source_type
            ).toUpperCase();


          const eventType =
            normalizeText(
              event?.event_type
            ).toUpperCase();


          const drugCode =
            getDrugCode(
              event
            );


          if (
            !drugCode
          ) {
            return false;
          }


          return (
            sourceType ===
              "XML2" ||
            eventType ===
              "DRUG"
          );
        }
      );


    // ==================================================
    // KHÔNG CÓ THUỐC
    // ==================================================

    if (
      allDrugs.length ===
      0
    ) {

      return {
        ruleId:
          rule.id,

        ruleCode:
          rule.code,

        status:
          "SKIP",

        severity:
          rule.severity,

        issueCount:
          0,

        message:
          "Hồ sơ không có thuốc cần kiểm tra.",

        details: {
          drugCount:
            0,

          violations:
            [],
        },
      };
    }


    // ==================================================
    // 2. UNIQUE DRUG CODES TRONG XML
    // ==================================================

    const allDrugCodes =
      Array.from(
        new Set(
          allDrugs
            .map(
              (
                drug
              ) =>
                normalizeCode(
                  getDrugCode(
                    drug
                  )
                )
            )
            .filter(
              Boolean
            )
        )
      );


    // ==================================================
    // 3. LOAD THUỐC HỢP LỆ TỪ catalog.drugs
    //
    // Chỉ:
    // - tồn tại
    // - active = true
    //
    // Thuốc không tồn tại / inactive:
    // DRUG_EXISTS chịu trách nhiệm.
    // ==================================================

    const catalogResult =
      await client.query<{
        code: string;
      }>(
        `
        SELECT
          code

        FROM
          catalog.drugs

        WHERE
          active =
          true

          AND LOWER(
            BTRIM(
              code
            )
          )
          =
          ANY(
            $1::text[]
          )
        `,
        [
          allDrugCodes,
        ]
      );


    const validDrugCodes =
      new Set<string>(
        catalogResult.rows
          .map(
            (
              row
            ) =>
              normalizeCode(
                row.code
              )
          )
          .filter(
            Boolean
          )
      );


    // ==================================================
    // 4. CHỈ GIỮ THUỐC HỢP LỆ
    // ==================================================

    const drugs =
      allDrugs.filter(
        (
          drug
        ) =>
          validDrugCodes.has(
            normalizeCode(
              getDrugCode(
                drug
              )
            )
          )
      );


    // ==================================================
    // KHÔNG CÓ THUỐC HỢP LỆ
    //
    // DRUG_EXISTS sẽ báo lỗi.
    // Rule này không báo thêm.
    // ==================================================

    if (
      drugs.length ===
      0
    ) {

      return {
        ruleId:
          rule.id,

        ruleCode:
          rule.code,

        status:
          "SKIP",

        severity:
          rule.severity,

        issueCount:
          0,

        message:
          "Không có thuốc hợp lệ trong Danh mục Thuốc để kiểm tra tương tác.",

        details: {
          totalDrugEvents:
            allDrugs.length,

          eligibleDrugEvents:
            0,

          skippedDrugCodes:
            allDrugCodes.filter(
              (
                code
              ) =>
                !validDrugCodes.has(
                  code
                )
            ),

          violations:
            [],
        },
      };
    }


    const violations:
      Record<
        string,
        unknown
      >[] =
      [];


    // ==================================================
    // 5. GOM THUỐC THEO MÃ
    //
    // Dùng key lowercase để không phân biệt hoa thường.
    // ==================================================

    const drugsByCode =
      new Map<
        string,
        any[]
      >();


    for (
      const drug
      of drugs
    ) {

      const code =
        normalizeCode(
          getDrugCode(
            drug
          )
        );


      if (
        !code
      ) {
        continue;
      }


      const current =
        drugsByCode.get(
          code
        ) ??
        [];


      current.push(
        drug
      );


      drugsByCode.set(
        code,
        current
      );
    }


    // ==================================================
    // 6. TRÙNG MÃ THUỐC
    // ==================================================

    if (
      checkDuplicateDrug
    ) {

      for (
        const [
          normalizedDrugCode,
          items,
        ]
        of drugsByCode.entries()
      ) {

        if (
          items.length <=
          1
        ) {
          continue;
        }


        // Cung ma thuoc nhung SO_LUONG bi tach ra de du mot lieu trinh:
        // khong tinh la hai lan ke don. Neu khong du du lieu thi van bao loi.
        if (isSplitDispensingOfOneCourse(items)) {
          continue;
        }


        const displayDrugCode =
          getDrugCode(
            items[0]
          );


        violations.push({
          type:
            "DUPLICATE_DRUG",

          drugCode:
            displayDrugCode ||
            normalizedDrugCode,

          drugName:
            getDrugName(
              items[0]
            ) ||
            null,

          occurrenceCount:
            items.length,

          eventIds:
            items.map(
              (
                item
              ) =>
                item?.id
            ),
        });
      }
    }


    // ==================================================
    // 7. LẤY DANH MỤC HOẠT CHẤT
    //
    // Chỉ lấy cho thuốc hợp lệ.
    // ==================================================

    const drugCodes =
      Array.from(
        drugsByCode.keys()
      );


    const ingredientResult =
      await client.query<
        DrugIngredientRow
      >(
        `
        SELECT
          drug_code,
          active_ingredient,
          active_ingredient_code

        FROM
          catalog.drug_active_ingredients

        WHERE
          active =
          true

          AND LOWER(
            BTRIM(
              drug_code
            )
          )
          =
          ANY(
            $1::text[]
          )

        ORDER BY
          drug_code,
          active_ingredient
        `,
        [
          drugCodes,
        ]
      );


    const ingredientRows =
      ingredientResult.rows;


    // ==================================================
    // 8. GOM HOẠT CHẤT THEO THUỐC
    // ==================================================

    const ingredientsByDrug =
      new Map<
        string,
        DrugIngredientRow[]
      >();


    for (
      const row
      of ingredientRows
    ) {

      const drugCode =
        normalizeCode(
          row.drug_code
        );


      if (
        !drugCode
      ) {
        continue;
      }


      const list =
        ingredientsByDrug.get(
          drugCode
        ) ??
        [];


      list.push(
        row
      );


      ingredientsByDrug.set(
        drugCode,
        list
      );
    }


    // ==================================================
    // 9. THUỐC CHƯA CẤU HÌNH HOẠT CHẤT
    // ==================================================

    const unmappedDrugs =
      drugCodes.filter(
        (
          drugCode
        ) =>
          !ingredientsByDrug.has(
            drugCode
          )
      );


    // ==================================================
    // 10. GOM SỰ XUẤT HIỆN HOẠT CHẤT
    // ==================================================

    interface IngredientOccurrence {
      drugCode: string;

      drugName:
        string |
        null;

      ingredient: string;
    }


    const ingredientOccurrences =
      new Map<
        string,
        IngredientOccurrence[]
      >();


    for (
      const drug
      of drugs
    ) {

      const drugCode =
        normalizeCode(
          getDrugCode(
            drug
          )
        );


      const ingredientList =
        ingredientsByDrug.get(
          drugCode
        ) ??
        [];


      for (
        const ingredient
        of ingredientList
      ) {

        const key =
          normalize(
            ingredient
              .active_ingredient_code ||
            ingredient
              .active_ingredient
          );


        if (
          !key
        ) {
          continue;
        }


        const list =
          ingredientOccurrences.get(
            key
          ) ??
          [];


        list.push({
          drugCode:
            getDrugCode(
              drug
            ),

          drugName:
            getDrugName(
              drug
            ) ||
            null,

          ingredient:
            ingredient
              .active_ingredient,
        });


        ingredientOccurrences.set(
          key,
          list
        );
      }
    }


    // ==================================================
    // 11. TRÙNG HOẠT CHẤT
    // ==================================================

    if (
      checkDuplicateIngredient
    ) {

      for (
        const [
          ingredientKey,
          occurrences,
        ]
        of ingredientOccurrences
          .entries()
      ) {

        // Chỉ tính thuốc khác mã.
        //
        // Nếu một mã thuốc xuất hiện nhiều lần,
        // DUPLICATE_DRUG đã chịu trách nhiệm.

        const distinctDrugCodes =
          Array.from(
            new Set(
              occurrences.map(
                (
                  item
                ) =>
                  normalizeCode(
                    item.drugCode
                  )
              )
            )
          );


        if (
          distinctDrugCodes.length <=
          1
        ) {
          continue;
        }


        // =================================================
        // Tránh cùng một thuốc xuất hiện nhiều event
        // làm danh sách drugs bị lặp.
        // =================================================

        const uniqueDrugMap =
          new Map<
            string,
            IngredientOccurrence
          >();


        for (
          const occurrence
          of occurrences
        ) {

          const key =
            normalizeCode(
              occurrence.drugCode
            );


          if (
            !uniqueDrugMap.has(
              key
            )
          ) {

            uniqueDrugMap.set(
              key,
              occurrence
            );
          }
        }


        violations.push({
          type:
            "DUPLICATE_ACTIVE_INGREDIENT",

          ingredientKey,

          ingredient:
            occurrences[0]
              ?.ingredient,

          drugs:
            Array.from(
              uniqueDrugMap.values()
            ),

          drugCodes:
            distinctDrugCodes,
        });
      }
    }


    // ==================================================
    // 12. TƯƠNG TÁC HOẠT CHẤT
    // ==================================================

    if (
      checkInteractions &&
      ingredientOccurrences.size >
        1
    ) {

      // =================================================
      // Danh sách tên hoạt chất thực tế
      // =================================================

      const ingredientNames =
        Array.from(
          ingredientOccurrences
            .values()
        )
          .flat()
          .map(
            (
              item
            ) =>
              item.ingredient
          )
          .filter(
            Boolean
          );


      const uniqueIngredientNames =
        Array.from(
          new Set(
            ingredientNames
          )
        );


      // =================================================
      // Query các tương tác có liên quan
      // =================================================

      const interactionResult =
        await client.query<
          InteractionRow
        >(
          `
          SELECT
            ingredient_a,
            ingredient_b,
            severity,
            description

          FROM
            catalog.drug_interaction_rules

          WHERE
            active =
            true

            AND (
              LOWER(
                BTRIM(
                  ingredient_a
                )
              )
              =
              ANY(
                $1::text[]
              )

              OR

              LOWER(
                BTRIM(
                  ingredient_b
                )
              )
              =
              ANY(
                $1::text[]
              )
            )
          `,
          [
            uniqueIngredientNames.map(
              (
                item
              ) =>
                normalizeText(
                  item
                ).toLowerCase()
            ),
          ]
        );


      // =================================================
      // Tránh cùng một cặp A-B bị báo lặp
      // =================================================

      const interactionKeys =
        new Set<string>();


      for (
        const interaction
        of interactionResult.rows
      ) {

        const a =
          normalize(
            interaction
              .ingredient_a
          );


        const b =
          normalize(
            interaction
              .ingredient_b
          );


        const occurrencesA =
          ingredientOccurrences.get(
            a
          );


        const occurrencesB =
          ingredientOccurrences.get(
            b
          );


        if (
          !occurrencesA ||
          !occurrencesB
        ) {
          continue;
        }


        // ===============================================
        // Nếu A và B thực chất normalize thành cùng key,
        // phần trùng hoạt chất đã xử lý.
        // Không báo interaction thêm.
        // ===============================================

        if (
          a ===
          b
        ) {
          continue;
        }


        const pairKey =
          [
            a,
            b,
          ]
            .sort()
            .join(
              "|"
            );


        if (
          interactionKeys.has(
            pairKey
          )
        ) {
          continue;
        }


        interactionKeys.add(
          pairKey
        );


        // ===============================================
        // Hai phía đều có mặt trong hồ sơ
        // ===============================================

        violations.push({
          type:
            "DRUG_INTERACTION",

          ingredientA:
            interaction
              .ingredient_a,

          ingredientB:
            interaction
              .ingredient_b,

          severity:
            interaction
              .severity,

          description:
            interaction
              .description,

          drugsA:
            occurrencesA,

          drugsB:
            occurrencesB,
        });
      }
    }


    // ==================================================
    // 13. CÓ LỖI
    // ==================================================

    if (
      violations.length >
      0
    ) {

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
          `Phát hiện ${violations.length} vấn đề liên quan thuốc/hoạt chất.`,

        details: {
          totalDrugEvents:
            allDrugs.length,

          drugCount:
            drugs.length,

          uniqueDrugCount:
            drugCodes.length,

          skippedDrugCodes:
            allDrugCodes.filter(
              (
                code
              ) =>
                !validDrugCodes.has(
                  code
                )
            ),

          unmappedDrugs,

          violations,
        },
      };
    }


    // ==================================================
    // 14. KHÔNG ĐỦ DANH MỤC HOẠT CHẤT
    //
    // Không được PASS giả nếu rule cần hoạt chất
    // nhưng thuốc chưa có mapping hoạt chất.
    // ==================================================

    if (
      (
        checkDuplicateIngredient ||
        checkInteractions
      ) &&
      unmappedDrugs.length >
        0
    ) {

      return {
        ruleId:
          rule.id,

        ruleCode:
          rule.code,

        status:
          "SKIP",

        severity:
          rule.severity,

        issueCount:
          0,

        message:
          `Có ${unmappedDrugs.length} thuốc hợp lệ chưa được cấu hình hoạt chất nên chưa thể kiểm tra đầy đủ.`,

        details: {
          totalDrugEvents:
            allDrugs.length,

          drugCount:
            drugs.length,

          uniqueDrugCount:
            drugCodes.length,

          unmappedDrugs,

          violations:
            [],
        },
      };
    }


    // ==================================================
    // 15. PASS
    // ==================================================

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
        "Không phát hiện trùng thuốc, trùng hoạt chất hoặc tương tác thuốc.",

      details: {
        totalDrugEvents:
          allDrugs.length,

        drugCount:
          drugs.length,

        uniqueDrugCount:
          drugCodes.length,

        unmappedDrugs,

        violations:
          [],
      },
    };
  },
};