import {
  Router,
} from "express";

import multer
  from "multer";

import {
  getCatalogRules,
  addCatalogRule,
  editCatalogRule,
  removeCatalogRule,

  getMachines,
  getMachineByCode,
  addMachine,
  editMachine,
  removeMachine,

  getServices,
  getServiceByCode,
  addService,
  editService,
  removeService,

  getDepartments,
  getDepartmentByCode,
  addDepartment,
  editDepartment,
  removeDepartment,

  getMedicalStaffList,
  getMedicalStaffById,
  addMedicalStaff,
  editMedicalStaff,
  removeMedicalStaff,

  getDrugs,
  getDrugByCode,
  addDrug,
  editDrug,
  removeDrug,
} from "./catalog.controller.js";

import {
  requireAuth,
} from "../auth/auth.middleware.js";

import {
  requireAdmin,
} from "../auth/admin.middleware.js";

import {
  importDrugsExcel,
} from "./drug-import.controller.js";

import {
  importServicesExcel,
} from "./service-import.controller.js";

import {
  importMedicalStaffExcel,
} from "./medical-staff-import.controller.js";

import examinationServiceRouter
  from "./examination-service.routes.js";

import staffScheduleRoutes
  from "./staff-schedule.routes.js";

import {
  downloadServiceStaffTemplate,
  importServiceStaffExcelController,
  previewServiceStaffExcel,
} from "./service-staff-import.controller.js";


// ======================================================
// ICD WARNING
// ======================================================

import {
  getIcdWarningsList,
  createIcdWarningController,
  updateIcdWarningController,
  toggleIcdWarningActiveController,
} from "./icd-warning.controller.js";

import {
  importIcdWarningsExcel,
} from "./icd-warning-import.controller.js";


// ======================================================
// ROUTER
// ======================================================

const router =
  Router();


// ======================================================
// EXCEL UPLOAD
// ======================================================

const excelUpload =
  multer({
    storage:
      multer.memoryStorage(),

    limits: {
      fileSize:
        10 *
        1024 *
        1024,
    },
  });


const medicalStaffExcelUpload =
  multer({
    storage:
      multer.memoryStorage(),

    limits: {
      fileSize:
        30 *
        1024 *
        1024,
    },
  });


const serviceExcelUpload =
  multer({
    storage:
      multer.memoryStorage(),

    limits: {
      fileSize:
        30 *
        1024 *
        1024,
    },
  });


const drugExcelUpload =
  multer({
    storage:
      multer.memoryStorage(),

    limits: {
      fileSize:
        30 *
        1024 *
        1024,
    },
  });


// ======================================================
// AUTH
//
// Toàn bộ catalog chỉ ADMIN
// ======================================================

router.use(
  requireAuth,
  requireAdmin
);


// ======================================================
// EXAMINATION SERVICES
// ======================================================

router.use(
  "/examination-services",
  examinationServiceRouter
);


// ======================================================
// MACHINES
// ======================================================

router.get(
  "/machines",
  getMachines
);


router.get(
  "/machines/:code",
  getMachineByCode
);


router.post(
  "/machines",
  addMachine
);


router.put(
  "/machines/:code",
  editMachine
);


router.delete(
  "/machines/:code",
  removeMachine
);


// ======================================================
// SERVICES / DVKT
// ======================================================

router.get(
  "/services",
  getServices
);


router.post(
  "/services/import",
  serviceExcelUpload.single(
    "file"
  ),
  importServicesExcel
);


router.get(
  "/services/:code",
  getServiceByCode
);


router.post(
  "/services",
  addService
);


router.put(
  "/services/:code",
  editService
);


router.delete(
  "/services/:code",
  removeService
);


// ======================================================
// DEPARTMENTS / KHOA
// ======================================================

router.get(
  "/departments",
  getDepartments
);


router.get(
  "/departments/:code",
  getDepartmentByCode
);


router.post(
  "/departments",
  addDepartment
);


router.put(
  "/departments/:code",
  editDepartment
);


router.delete(
  "/departments/:code",
  removeDepartment
);


// ======================================================
// MEDICAL STAFF / NHÂN VIÊN Y TẾ
// ======================================================

router.get(
  "/medical-staff",
  getMedicalStaffList
);


router.post(
  "/medical-staff/import",
  medicalStaffExcelUpload.single(
    "file"
  ),
  importMedicalStaffExcel
);


router.get(
  "/medical-staff/:id",
  getMedicalStaffById
);


router.post(
  "/medical-staff",
  addMedicalStaff
);


router.put(
  "/medical-staff/:id",
  editMedicalStaff
);


router.delete(
  "/medical-staff/:id",
  removeMedicalStaff
);


// ======================================================
// STAFF SCHEDULES
// ======================================================

router.use(
  "/staff-schedules",
  staffScheduleRoutes
);


// ======================================================
// DRUGS / THUỐC
// ======================================================

router.post(
  "/drugs/import",
  drugExcelUpload.single(
    "file"
  ),
  importDrugsExcel
);


router.get(
  "/drugs",
  getDrugs
);


router.get(
  "/drugs/:code",
  getDrugByCode
);


router.post(
  "/drugs",
  addDrug
);


router.put(
  "/drugs/:code",
  editDrug
);


router.delete(
  "/drugs/:code",
  removeDrug
);


// ======================================================
// SERVICE STAFF
// ======================================================

router.get(
  "/service-staff/template",
  downloadServiceStaffTemplate
);


router.post(
  "/service-staff/import/preview",
  excelUpload.single(
    "file"
  ),
  previewServiceStaffExcel
);


router.post(
  "/service-staff/import",
  excelUpload.single(
    "file"
  ),
  importServiceStaffExcelController
);


// ======================================================
// ICD WARNING / ICD CẢNH BÁO
// ======================================================
//
// GET
// /api/catalog/icd-warnings
//
// POST
// /api/catalog/icd-warnings
//
// PUT
// /api/catalog/icd-warnings/:id
//
// PATCH
// /api/catalog/icd-warnings/:id/toggle-active
//
// POST IMPORT
// /api/catalog/icd-warnings/import
//
// ======================================================


// ======================================================
// GET ICD WARNING LIST
// ======================================================

router.get(
  "/icd-warnings",
  getIcdWarningsList
);


// ======================================================
// IMPORT ICD WARNING EXCEL
//
// PHẢI đặt route /import trước các route động.
// ======================================================

router.post(
  "/icd-warnings/import",
  excelUpload.single(
    "file"
  ),
  importIcdWarningsExcel
);


// ======================================================
// CREATE ICD WARNING
// ======================================================

router.post(
  "/icd-warnings",
  createIcdWarningController
);


// ======================================================
// UPDATE ICD WARNING
// ======================================================

router.put(
  "/icd-warnings/:id",
  updateIcdWarningController
);


// ======================================================
// TOGGLE ACTIVE ICD WARNING
// ======================================================

router.patch(
  "/icd-warnings/:id/toggle-active",
  toggleIcdWarningActiveController
);


// ======================================================
// GENERIC CATALOG
//
// CÁC ROUTE NÀY PHẢI ĐỂ CUỐI
// ======================================================

router.get(
  "/:type",
  getCatalogRules
);


router.post(
  "/:type",
  addCatalogRule
);


router.put(
  "/:type/:id",
  editCatalogRule
);


router.delete(
  "/:type/:id",
  removeCatalogRule
);


// ======================================================
// EXPORT
// ======================================================

export default router;