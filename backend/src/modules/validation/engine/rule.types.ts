import type { PoolClient } from "pg";

export type RuleResultStatus =
  | "PASS"
  | "FAIL"
  | "SKIP";


export type RuleSeverity =
  | "ERROR"
  | "WARNING"
  | "INFO";

export interface RuleRuntime {
  client: PoolClient;
  checkRunId: string;
}

export interface ValidationRule {
  id: string;

  code: string;

  name: string;

  description?: string | null;

  validator_key: string;

  source_xml?: string | null;

  target_xml?: string | null;

  category?: string | null;

  enabled: boolean;

  required: boolean;

  blocks_ok: boolean;

  severity: RuleSeverity;

  priority: number;

  config: Record<
    string,
    unknown
  >;
}


export interface RuleResult {
  ruleId: string;

  ruleCode: string;

  status:
    | "PASS"
    | "FAIL"
    | "SKIP";

  severity:
    | "ERROR"
    | "WARNING"
    | "INFO";

  message: string;

  // Số lỗi thực tế rule tìm thấy
  issueCount?: number;

  details?: Record<string, unknown>;

  
}


export interface MedicalCaseContext {
  medicalCase: {
    id: string;

    ma_lk?: string;

    ma_bn?: string;

    ho_ten?: string;

    ma_benh_chinh?: string;

    ma_benh_kt?: string;

    ngay_vao?: Date | string;

    ngay_ra?: Date | string;
  };

  xml1?: any;

  xml2?: any;

  xml3?: any;

  xml4?: any;

  xml5?: any;

  events: any[];

  catalog: Record<
    string,
    any
  >;
}


export interface RuleValidator {
  evaluate(
    context: MedicalCaseContext,
    rule: ValidationRule,
    runtime: RuleRuntime
  ): Promise<RuleResult>;
}