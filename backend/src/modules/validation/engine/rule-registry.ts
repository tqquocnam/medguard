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
};