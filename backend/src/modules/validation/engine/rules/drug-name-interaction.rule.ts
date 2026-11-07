import type {
  RuleValidator,
} from "../rule.types.js";

import {
  drugInteractionRule,
} from "./drug-interaction.rule.js";

interface InteractionRow {
  drug_name_a: string;
  drug_name_b: string;
  ingredient_a: string;
  ingredient_b: string;
  description: string | null;
}

const text = (value: unknown): string =>
  String(value ?? "").trim();

// Chỉ chuẩn hóa Unicode, khoảng trắng và chữ hoa/thường.
// Giữ nguyên dấu, hàm lượng, dạng thuốc và dấu câu.
const normalizeName = (
  value: unknown
): string =>
  text(value)
    .normalize("NFC")
    .replace(/\s+/gu, " ")
    .toLocaleLowerCase("vi");

export const drugNameInteractionRule:
  RuleValidator = {
  async evaluate(context, rule, runtime) {
    // Giữ kiểm tra trùng thuốc/hoạt chất của rule cũ.
    // Tắt riêng tương tác theo hoạt chất trong rule cũ.
    const previous =
      await drugInteractionRule.evaluate(
        context,
        {
          ...rule,
          config: {
            ...rule.config,
            checkInteractions: false,
          },
        },
        runtime
      );

    if (
      rule.config?.checkInteractions === false
    ) {
      return previous;
    }

    const names = new Map<string, string>();

    let missingNameCount = 0;

    for (const event of context.events ?? []) {
      const raw = event?.raw_data ?? {};

      const isDrug =
        text(event?.source_type)
          .toUpperCase() === "XML2" ||
        text(event?.event_type)
          .toUpperCase() === "DRUG";

      if (!isDrug) continue;

      const name =
        text(event?.item_name) ||
        text(raw.TEN_THUOC);

      const key = normalizeName(name);

      if (!key) {
        missingNameCount++;
        continue;
      }

      if (!names.has(key)) {
        names.set(key, name);
      }
    }

    const result =
      await runtime.client.query<
        InteractionRow
      >(
        `
        SELECT
          drug_name_a,
          drug_name_b,
          ingredient_a,
          ingredient_b,
          description
        FROM catalog.drug_interaction_rules
        WHERE active = true
          AND NULLIF(
            BTRIM(drug_name_a), ''
          ) IS NOT NULL
          AND NULLIF(
            BTRIM(drug_name_b), ''
          ) IS NOT NULL
        ORDER BY id
        `
      );

    const seen = new Set<string>();

    const interactions:
      Record<string, unknown>[] = [];

    for (const row of result.rows) {
      const a = normalizeName(
        row.drug_name_a
      );

      const b = normalizeName(
        row.drug_name_b
      );

      if (!a || !b || a === b) continue;

      // Cả hai tên thuốc phải có trong hồ sơ.
      if (
        !names.has(a) ||
        !names.has(b)
      ) {
        continue;
      }

      // A + B và B + A chỉ báo một lần.
      const pairKey = JSON.stringify(
        [a, b].sort()
      );

      if (seen.has(pairKey)) continue;

      seen.add(pairKey);

      const drugNameA = names.get(a)!;
      const drugNameB = names.get(b)!;

      const ingredientA = text(
        row.ingredient_a
      );

      const ingredientB = text(
        row.ingredient_b
      );

      const description = text(
        row.description
      );

      const ingredientMessage =
        ingredientA || ingredientB
          ? (
              ` Hoạt chất: ` +
              `${ingredientA || "Chưa nhập"} + ` +
              `${ingredientB || "Chưa nhập"}.`
            )
          : "";

      interactions.push({
        type: "DRUG_INTERACTION",
        severity: "ERROR",

        drugNameA,
        drugNameB,

        ingredientA,
        ingredientB,

        description,

        displayMessage:
          `Tương tác thuốc: ` +
          `${drugNameA} + ${drugNameB}.` +
          ingredientMessage +
          (
            description
              ? ` ${description}`
              : ""
          ),
      });
    }

    if (interactions.length === 0) {
      if (
        missingNameCount > 0 &&
        previous.status !== "FAIL"
      ) {
        return {
          ...previous,
          status: "SKIP",
          issueCount: 0,
          message:
            "Có dòng thuốc thiếu tên, chưa thể kiểm tra đầy đủ tương tác.",
          details: {
            ...previous.details,
            missingNameCount,
          },
        };
      }

      return previous;
    }

    const previousViolations =
      previous.status === "FAIL" &&
      Array.isArray(
        previous.details?.violations
      )
        ? previous.details.violations
        : [];

    const violations = [
      ...previousViolations,
      ...interactions,
    ];

    const previousIssueCount =
      previous.status === "FAIL"
        ? (
            previous.issueCount ??
            previousViolations.length
          )
        : 0;

    return {
      ruleId: rule.id,
      ruleCode: rule.code,

      status: "FAIL",
      severity: "ERROR",

      issueCount:
        previousIssueCount +
        interactions.length,

      message:
        `Phát hiện ${interactions.length} ` +
        `cặp thuốc tương tác.`,

      details: {
        ...previous.details,
        interactionMatchBy: "DRUG_NAME",
        missingNameCount,
        violations,
      },
    };
  },
};