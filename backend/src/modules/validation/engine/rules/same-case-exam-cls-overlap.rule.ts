import type { RuleValidator } from "../rule.types.js";

// Keep the registered validator for existing database configurations.
// Only ORDER_TIME_SEQUENCE owns service-order versus exam-order validation.
export const sameCaseExamClsOverlapRule: RuleValidator = {
  async evaluate(_context, rule) {
    return {
      ruleId: rule.id,
      ruleCode: rule.code,
      status: "SKIP",
      severity: rule.severity,
      issueCount: 0,
      message: "Không áp dụng kiểm tra khoảng khám trùng thời gian thực hiện CLS; chỉ đối chiếu y lệnh dịch vụ với y lệnh công khám.",
      details: { violations: [], retired: true },
    };
  },
};
