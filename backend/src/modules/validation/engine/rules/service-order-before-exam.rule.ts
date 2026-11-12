import type { RuleValidator } from "../rule.types.js";

// Keep the registered validator for existing database configurations.
// Only ORDER_TIME_SEQUENCE owns service-order versus exam-order validation.
export const serviceOrderBeforeExamRule: RuleValidator = {
  async evaluate(_context, rule) {
    return {
      ruleId: rule.id,
      ruleCode: rule.code,
      status: "SKIP",
      severity: rule.severity,
      issueCount: 0,
      message: "Đối chiếu y lệnh dịch vụ với y lệnh công khám được thực hiện tại ORDER_TIME_SEQUENCE, tránh báo trùng lỗi.",
      details: { violations: [], supersededBy: "ORDER_TIME_SEQUENCE" },
    };
  },
};
