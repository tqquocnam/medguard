import {
  Router,
} from "express";

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

import multer
  from "multer";

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

const router =
  Router();


// ======================================================
// AUTH
// ======================================================
//
// Toàn bộ catalog chỉ ADMIN.
//
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

router.use(
  requireAuth,
  requireAdmin
);


router.use(
  "/examination-services",
  examinationServiceRouter
);

// ======================================================
// MACHINES
//
// PHẢI đặt trước /:type
// ======================================================


// GET /api/catalog/machines

router.get(
  "/machines",
  getMachines
);


// GET /api/catalog/machines/:code

router.get(
  "/machines/:code",
  getMachineByCode
);


// POST /api/catalog/machines

router.post(
  "/machines",
  addMachine
);


// PUT /api/catalog/machines/:code

router.put(
  "/machines/:code",
  editMachine
);


// DELETE /api/catalog/machines/:code
//
// Thực tế là active = false
//

router.delete(
  "/machines/:code",
  removeMachine
);


// ======================================================
// EXISTING RULE CATALOG
// ======================================================
//
// Các route tổng quát phải nằm SAU machines.
//
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
//
// PHẢI đặt trước route tổng quát /:type
// ======================================================


// GET /api/catalog/departments

router.get(
  "/departments",
  getDepartments
);


// GET /api/catalog/departments/:code

router.get(
  "/departments/:code",
  getDepartmentByCode
);


// POST /api/catalog/departments

router.post(
  "/departments",
  addDepartment
);


// PUT /api/catalog/departments/:code

router.put(
  "/departments/:code",
  editDepartment
);


// DELETE /api/catalog/departments/:code
//
// Thực tế là active = false
//

router.delete(
  "/departments/:code",
  removeDepartment
);




// ======================================================
// MEDICAL STAFF / NHÂN VIÊN Y TẾ
// ======================================================


// GET /api/catalog/medical-staff

router.get(
  "/medical-staff",
  getMedicalStaffList
);

router.use(
  "/staff-schedules",
  staffScheduleRoutes
);

router.post(
  "/medical-staff/import",
  medicalStaffExcelUpload.single(
    "file"
  ),
  importMedicalStaffExcel
);

// GET /api/catalog/medical-staff/:id

router.get(
  "/medical-staff/:id",
  getMedicalStaffById
);


// POST /api/catalog/medical-staff

router.post(
  "/medical-staff",
  addMedicalStaff
);


// PUT /api/catalog/medical-staff/:id

router.put(
  "/medical-staff/:id",
  editMedicalStaff
);


// DELETE /api/catalog/medical-staff/:id
//
// Thực tế active = false
//

router.delete(
  "/medical-staff/:id",
  removeMedicalStaff
);


// ======================================================
// DRUGS / THUỐC
// ======================================================
// ======================================================
// IMPORT DRUG EXCEL
// ======================================================

router.post(
  "/drugs/import",
  drugExcelUpload.single(
    "file"
  ),
  importDrugsExcel
);


// ======================================================
// DRUG CRUD
// ======================================================

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

router.get(
  "/service-staff/template",
  requireAuth,
  requireAdmin,
  downloadServiceStaffTemplate
);


router.post(
  "/service-staff/import/preview",
  requireAuth,
  requireAdmin,
  excelUpload.single(
    "file"
  ),
  previewServiceStaffExcel
);


router.post(
  "/service-staff/import",
  requireAuth,
  requireAdmin,
  excelUpload.single(
    "file"
  ),
  importServiceStaffExcelController
);

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


export default router;