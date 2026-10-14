
import type { RuleValidator } from "../rule.types.js";

import {
  createAgeValidator,
} from "./age-rule.helper.js";

// ============================================
// SERVICE_AGE
// XML1 + XML3
// catalog.service_age_rules
// ============================================

export const serviceAgeRule: RuleValidator =
  createAgeValidator("service");
