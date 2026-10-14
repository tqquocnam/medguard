

import type { RuleValidator } from "../rule.types.js";

import {
  createAgeValidator,
} from "./age-rule.helper.js";

// ============================================
// DRUG_AGE
// XML1 + XML2
// catalog.drug_age_rules
// ============================================

export const drugAgeRule: RuleValidator =
  createAgeValidator("drug");
