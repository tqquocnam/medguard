import type {
  RuleValidator,
} from "./rule.types.js";


import {
  icdRequiredRule,
} from "../engine/rules/icd-required.rule.js";


import {
  visitTimeRule,
} from "../engine/rules/visit-time.rule.js";


import {
  orderTimeRule,
} from "../engine/rules/order-time.rule.js";


import {
  eventInsideVisitRule,
} from "../engine/rules/event-inside-visit.rule.js";


import {
  staffTimeOverlapRule,
} from "../engine/rules/staff-time-overlap.rule.js";


import {
  examMinTimeRule,
} from "../engine/rules/exam-min-time.rule.js"
import {
  serviceDiagnosisRule,
} from "./rules/service-diagnosis.rule.js";

import {
  serviceIcdRule,
} from "./rules/service-icd.rule.js";


import {
  drugIcdRule,
} from "./rules/drug-icd.rule.js";


import {
  drugInteractionRule,
} from "./rules/drug-interaction.rule.js";

import {
  machineExistsRule,
} from "./rules/machine-exists.rule.js";


import {
  serviceMachineRequiredRule,
} from "./rules/service-machine-required.rule.js";


import {
  serviceMachineMismatchRule,
} from "./rules/service-machine-mismatch.rule.js";


import {
  serviceDurationRule,
} from "./rules/service-duration.rule.js";

import {
  staffExistsRule,
} from "./rules/staff-exists.rule.js";

import {
  staffDepartmentMismatchRule,
} from "./rules/staff-department-mismatch.rule.js";

import {
  departmentExistsRule,
} from "./rules/department-exists.rule.js";

import {
  drugExistsRule,
} from "./rules/drug-exists.rule.js";

import {
  staffScheduleRule,
} from "./rules/staff-schedule.rule.js";


import {
  serviceStaffRule,
} from "./rules/service-staff.rule.js";

import {
  icdWarningRule,
} from "./rules/icd-warning.rule.js";

import {
  kcbTypeRule,
} from "./rules/kcb-type.rule.js";

import {
  outpatientTreatmentTimeRule,
} from "./rules/outpatient-treatment-time.rule.js";


import {
  outpatientDailyServiceRule,
} from "./rules/outpatient-daily-service.rule.js";


import {
  outpatientClinicalProgressRule,
} from "./rules/outpatient-clinical-progress.rule.js";


import {
  yhctCaseIdentificationRule,
} from "./rules/yhct-case-identification.rule.js";


import {
  yhctServiceDiagnosisRule,
} from "./rules/yhct-service-diagnosis.rule.js";


import {
  outpatientClsResultRule,
} from "./rules/outpatient-cls-result.rule.js";

import {
  yhctServiceFrequencyRule,
} from "./rules/yhct-service-frequency.rule.js";

import {
  yhctPerformOverlapRule,
} from "./rules/yhct-perform-overlap.rule.js";

import {
  yhctPerformScheduleRule,
} from "./rules/yhct-perform-schedule.rule.js";

import { yhctOrderPerformTimeRule } from "./rules/yhct-order-perform-time.rule.js";

import { yhctDailyStaffWorkloadRule } from "./rules/yhct-daily-staff-workload.rule.js";

import {
  yhctMachineDailyUsageRule,
} from "./rules/yhct-machine-daily-usage.rule.js";


import {
  yhctDailyTreatmentContinuityRule,
} from "./rules/yhct-daily-treatment-continuity.rule.js";

import {
  yhctClinicalProgressDuplicateRule,
} from "./rules/yhct-clinical-progress-duplicate.rule.js";

import {
  yhctXml3Xml5TechniqueMatchRule,
} from "./rules/yhct-xml3-xml5-technique-match.rule.js";

import {
  yhctDailyStaffConsistencyRule,
} from "./rules/yhct-daily-staff-consistency.rule.js";

import {
  yhctClinicalProgressQualityRule,
} from "./rules/yhct-clinical-progress-quality.rule.js";

import {
  yhctTreatmentEpisodeReviewRule,
} from "./rules/yhct-treatment-episode-review.rule.js";

import {
  resultMatchServiceRule,
} from "./rules/result-match-service.rule.js";

import {
  drugAgeRule,
} from "./rules/drug-age.rule.js";

import {
  serviceAgeRule,
} from "./rules/service-age.rule.js";

import {
  entForeignBodyCombinedPaymentRule,
} from "./rules/ent-foreign-body-combined-payment.rule.js";


import {
  serviceCalciumElectrolyteExclusionRule,
} from "./rules/service-calcium-electrolyte-exclusion.rule.js";


import {
  serviceChestXrayExclusionRule,
} from "./rules/service-chest-xray-exclusion.rule.js";

import {
  yhctSameCaseServiceOverlapRule,
} from "./rules/yhct-same-case-service-overlap.rule.js";


import {
  yhctExamPaymentRateRule,
} from "./rules/yhct-exam-payment-rate.rule.js";

import {
  machineTimeOverlapRule,
} from "./rules/machine-time-overlap.rule.js";

export const ruleRegistry:
  Record<
    string,
    RuleValidator
  > = {

  ICD_REQUIRED:
    icdRequiredRule,

  VISIT_TIME_VALID:
    visitTimeRule,

  ORDER_TIME_SEQUENCE:
    orderTimeRule,

  EVENT_INSIDE_VISIT:
    eventInsideVisitRule,

STAFF_TIME_OVERLAP:
  staffTimeOverlapRule,

EXAM_MIN_TIME:
  examMinTimeRule,

  SERVICE_DIAGNOSIS:
  serviceDiagnosisRule,
SERVICE_ICD:
  serviceIcdRule,

  DRUG_ICD:
  drugIcdRule,

DRUG_INTERACTION:
  drugInteractionRule,

  MACHINE_EXISTS:
  machineExistsRule,

  SERVICE_MACHINE_REQUIRED:
  serviceMachineRequiredRule,

  SERVICE_MACHINE_MISMATCH:
  serviceMachineMismatchRule,

  SERVICE_DURATION:
  serviceDurationRule,


  STAFF_EXISTS:
  staffExistsRule,


  STAFF_DEPARTMENT_MISMATCH:
  staffDepartmentMismatchRule,


  DEPARTMENT_EXISTS:
  departmentExistsRule, 
  
  DRUG_EXISTS:
  drugExistsRule,

  STAFF_SCHEDULE:
  staffScheduleRule,


  SERVICE_STAFF:
  serviceStaffRule,

  ICD_WARNING:
  icdWarningRule,

  KCB_TYPE_VALID: 
  kcbTypeRule,

  
OUTPATIENT_TREATMENT_TIME:
  outpatientTreatmentTimeRule,

OUTPATIENT_DAILY_SERVICE:
  outpatientDailyServiceRule,

OUTPATIENT_CLINICAL_PROGRESS:
  outpatientClinicalProgressRule,


YHCT_CASE_IDENTIFICATION:
  yhctCaseIdentificationRule,


YHCT_SERVICE_DIAGNOSIS:
  yhctServiceDiagnosisRule,


OUTPATIENT_CLS_RESULT:
  outpatientClsResultRule,

YHCT_SERVICE_FREQUENCY:
  yhctServiceFrequencyRule,


YHCT_PERFORM_OVERLAP:
  yhctPerformOverlapRule,

YHCT_PERFORM_SCHEDULE:
  yhctPerformScheduleRule,

YHCT_ORDER_PERFORM_TIME: 
yhctOrderPerformTimeRule,

YHCT_DAILY_STAFF_WORKLOAD: 
yhctDailyStaffWorkloadRule,

YHCT_MACHINE_DAILY_USAGE:
  yhctMachineDailyUsageRule,

  YHCT_DAILY_TREATMENT_CONTINUITY:
  yhctDailyTreatmentContinuityRule,

  YHCT_CLINICAL_PROGRESS_DUPLICATE:
  yhctClinicalProgressDuplicateRule,

  YHCT_XML3_XML5_TECHNIQUE_MATCH:
  yhctXml3Xml5TechniqueMatchRule,

  YHCT_DAILY_STAFF_CONSISTENCY:
  yhctDailyStaffConsistencyRule,

  YHCT_CLINICAL_PROGRESS_QUALITY:
  yhctClinicalProgressQualityRule,
  YHCT_TREATMENT_EPISODE_REVIEW:
  yhctTreatmentEpisodeReviewRule,

  
RESULT_MATCH_SERVICE:
  resultMatchServiceRule,

DRUG_AGE: drugAgeRule,

SERVICE_AGE: serviceAgeRule,

  ENT_FOREIGN_BODY_COMBINED_PAYMENT:
    entForeignBodyCombinedPaymentRule,

SERVICE_CALCIUM_ELECTROLYTE_EXCLUSION:
  serviceCalciumElectrolyteExclusionRule,

  SERVICE_CHEST_XRAY_EXCLUSION:
  serviceChestXrayExclusionRule,

  YHCT_SAME_CASE_SERVICE_OVERLAP:
  yhctSameCaseServiceOverlapRule,

  
YHCT_EXAM_PAYMENT_RATE:
  yhctExamPaymentRateRule,

  MACHINE_TIME_OVERLAP:
  machineTimeOverlapRule,

};