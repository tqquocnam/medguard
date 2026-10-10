import type {
  Request,
  Response,
} from "express";

import {
  listCatalogRules,
  createCatalogRule,
  updateCatalogRule,
  deleteCatalogRule,

  listMachines,
  getMachine,
  createMachine,
  updateMachine,
  deleteMachine,

  listServices,
  getService,
  createService,
  updateService,
  deleteService,

  listDepartments,
  getDepartment,
  createDepartment,
  updateDepartment,
  deleteDepartment,

  listMedicalStaff,
  getMedicalStaff,
  createMedicalStaff,
  updateMedicalStaff,
  deleteMedicalStaff,

  listDrugs,
  getDrug,
  createDrug,
  updateDrug,
  deleteDrug,
} from "./catalog.service.js";


// ======================================================
// HELPERS
// ======================================================

function getRouteParam(
  value:
    string |
    string[] |
    undefined
): string {

  if (
    Array.isArray(
      value
    )
  ) {
    return String(
      value[0] ??
      ""
    ).trim();
  }


  return String(
    value ??
    ""
  ).trim();
}


function getQueryText(
  value:
    unknown
): string {

  if (
    Array.isArray(
      value
    )
  ) {
    return String(
      value[0] ??
      ""
    ).trim();
  }


  return String(
    value ??
    ""
  ).trim();
}


function getPage(
  value:
    unknown
): number {

  const parsed =
    Number(
      value ??
      1
    );


  if (
    !Number.isInteger(
      parsed
    )
  ) {
    return 1;
  }


  return Math.max(
    1,
    parsed
  );
}


function getPageSize(
  value:
    unknown
): number {

  const parsed =
    Number(
      value ??
      10
    );


  if (
    !Number.isInteger(
      parsed
    )
  ) {
    return 10;
  }


  return Math.min(
    100,
    Math.max(
      1,
      parsed
    )
  );
}


function getActiveQuery(
  value:
    unknown
):
boolean |
undefined {

  if (
    value ===
    "true"
  ) {
    return true;
  }


  if (
    value ===
    "false"
  ) {
    return false;
  }


  return undefined;
}


// ======================================================
// EXISTING RULE CONTROLLERS
// ======================================================


// ======================================================
// LIST CATALOG RULES
// ======================================================

export async function getCatalogRules(
  req:
    Request,

  res:
    Response
) {

  try {

    const rows =
      await listCatalogRules(
        getRouteParam(
          req.params.type
        )
      );


    res.json({
      success:
        true,

      data:
        rows,
    });

  } catch (
    error
  ) {

    res.status(
      400
    ).json({
      success:
        false,

      message:
        error instanceof
        Error
          ? error.message
          : "Có lỗi xảy ra.",
    });
  }
}


// ======================================================
// ADD RULE
// ======================================================

export async function addCatalogRule(
  req:
    Request,

  res:
    Response
) {

  try {

    const row =
      await createCatalogRule(
        getRouteParam(
          req.params.type
        ),
        req.body
      );


    res.status(
      201
    ).json({
      success:
        true,

      data:
        row,
    });

  } catch (
    error
  ) {

    res.status(
      400
    ).json({
      success:
        false,

      message:
        error instanceof
        Error
          ? error.message
          : "Không thể thêm dữ liệu.",
    });
  }
}


// ======================================================
// EDIT RULE
// ======================================================

export async function editCatalogRule(
  req:
    Request,

  res:
    Response
) {

  try {

    const row =
      await updateCatalogRule(
        getRouteParam(
          req.params.type
        ),
        getRouteParam(
          req.params.id
        ),
        req.body
      );


    res.json({
      success:
        true,

      data:
        row,
    });

  } catch (
    error
  ) {

    res.status(
      400
    ).json({
      success:
        false,

      message:
        error instanceof
        Error
          ? error.message
          : "Không thể cập nhật.",
    });
  }
}


// ======================================================
// REMOVE RULE
// ======================================================

export async function removeCatalogRule(
  req:
    Request,

  res:
    Response
) {

  try {

    await deleteCatalogRule(
      getRouteParam(
        req.params.type
      ),
      getRouteParam(
        req.params.id
      )
    );


    res.json({
      success:
        true,
    });

  } catch (
    error
  ) {

    res.status(
      400
    ).json({
      success:
        false,

      message:
        error instanceof
        Error
          ? error.message
          : "Không thể xóa.",
    });
  }
}


// ======================================================
// MACHINE CONTROLLERS
// ======================================================


// ======================================================
// LIST MACHINES
//
// GET /api/catalog/machines
// ======================================================

export async function getMachines(
  req:
    Request,

  res:
    Response
) {

  try {

    const page =
      getPage(
        req.query.page
      );


    const pageSize =
      getPageSize(
        req.query.pageSize
      );


    const active =
      getActiveQuery(
        req.query.active
      );


    const code =
      getQueryText(
        req.query.code
      );


    const name =
      getQueryText(
        req.query.name
      );


    const result =
      await listMachines({
        code:
          code ||
          undefined,

        name:
          name ||
          undefined,

        active,

        limit:
          pageSize,

        offset:
          (
            page -
            1
          ) *
          pageSize,
      });


    res.status(
      200
    ).json({
      success:
        true,

      data: {
        items:
          result.items,

        total:
          result.total,

        page,

        pageSize,
      },
    });

  } catch (
    error
  ) {

    console.error(
      "Get machines error:",
      error
    );


    res.status(
      500
    ).json({
      success:
        false,

      message:
        error instanceof
        Error
          ? error.message
          : "Không thể tải danh mục máy.",
    });
  }
}


// ======================================================
// GET ONE MACHINE
// ======================================================

export async function getMachineByCode(
  req:
    Request,

  res:
    Response
) {

  try {

    const code =
      getRouteParam(
        req.params.code
      );


    const result =
      await getMachine(
        code
      );


    if (
      !result
    ) {

      res.status(
        404
      ).json({
        success:
          false,

        message:
          "Không tìm thấy máy.",
      });

      return;
    }


    res.status(
      200
    ).json({
      success:
        true,

      data:
        result,
    });

  } catch (
    error
  ) {

    res.status(
      400
    ).json({
      success:
        false,

      message:
        error instanceof
        Error
          ? error.message
          : "Không thể tải thông tin máy.",
    });
  }
}


// ======================================================
// CREATE MACHINE
// ======================================================

export async function addMachine(
  req:
    Request,

  res:
    Response
) {

  try {

    const result =
      await createMachine(
        req.body ??
        {}
      );


    res.status(
      201
    ).json({
      success:
        true,

      message:
        "Thêm máy thành công.",

      data:
        result,
    });

  } catch (
    error
  ) {

    res.status(
      400
    ).json({
      success:
        false,

      message:
        error instanceof
        Error
          ? error.message
          : "Không thể thêm máy.",
    });
  }
}


// ======================================================
// UPDATE MACHINE
// ======================================================

export async function editMachine(
  req:
    Request,

  res:
    Response
) {

  try {

    const code =
      getRouteParam(
        req.params.code
      );


    const result =
      await updateMachine(
        code,
        req.body ??
        {}
      );


    res.status(
      200
    ).json({
      success:
        true,

      message:
        "Cập nhật máy thành công.",

      data:
        result,
    });

  } catch (
    error
  ) {

    res.status(
      400
    ).json({
      success:
        false,

      message:
        error instanceof
        Error
          ? error.message
          : "Không thể cập nhật máy.",
    });
  }
}


// ======================================================
// DISABLE MACHINE
// ======================================================

export async function removeMachine(
  req:
    Request,

  res:
    Response
) {

  try {

    const code =
      getRouteParam(
        req.params.code
      );


    await deleteMachine(
      code
    );


    res.status(
      200
    ).json({
      success:
        true,

      message:
        "Đã ngừng sử dụng máy.",
    });

  } catch (
    error
  ) {

    res.status(
      400
    ).json({
      success:
        false,

      message:
        error instanceof
        Error
          ? error.message
          : "Không thể ngừng sử dụng máy.",
    });
  }
}


// ======================================================
// SERVICE / DVKT CONTROLLERS
// ======================================================


// ======================================================
// LIST DVKT
// ======================================================

export async function getServices(
  req:
    Request,

  res:
    Response
) {

  try {

    const page =
      getPage(
        req.query.page
      );


    const pageSize =
      getPageSize(
        req.query.pageSize
      );


    const active =
      getActiveQuery(
        req.query.active
      );


    const code =
      getQueryText(
        req.query.code
      );


    const name =
      getQueryText(
        req.query.name
      );


    const groupCode =
      getQueryText(
        req.query.groupCode
      );


    const result =
      await listServices({
        code:
          code ||
          undefined,

        name:
          name ||
          undefined,

        groupCode:
          groupCode ||
          undefined,

        active,

        limit:
          pageSize,

        offset:
          (
            page -
            1
          ) *
          pageSize,
      });


    res.json({
      success:
        true,

      data: {
        ...result,

        page,

        pageSize,
      },
    });

  } catch (
    error
  ) {

    res.status(
      500
    ).json({
      success:
        false,

      message:
        error instanceof
        Error
          ? error.message
          : "Không thể tải DVKT.",
    });
  }
}


// ======================================================
// GET DVKT
// ======================================================

export async function getServiceByCode(
  req:
    Request,

  res:
    Response
) {

  try {

    const code =
      getRouteParam(
        req.params.code
      );


    const row =
      await getService(
        code
      );


    if (
      !row
    ) {

      res.status(
        404
      ).json({
        success:
          false,

        message:
          "Không tìm thấy DVKT.",
      });

      return;
    }


    res.json({
      success:
        true,

      data:
        row,
    });

  } catch (
    error
  ) {

    res.status(
      400
    ).json({
      success:
        false,

      message:
        error instanceof
        Error
          ? error.message
          : "Không thể tải DVKT.",
    });
  }
}


// ======================================================
// ADD DVKT
// ======================================================

export async function addService(
  req:
    Request,

  res:
    Response
) {

  try {

    const row =
      await createService(
        req.body ??
        {}
      );


    res.status(
      201
    ).json({
      success:
        true,

      message:
        "Thêm DVKT thành công.",

      data:
        row,
    });

  } catch (
    error
  ) {

    res.status(
      400
    ).json({
      success:
        false,

      message:
        error instanceof
        Error
          ? error.message
          : "Không thể thêm DVKT.",
    });
  }
}


// ======================================================
// UPDATE DVKT
// ======================================================

export async function editService(
  req:
    Request,

  res:
    Response
) {

  try {

    const code =
      getRouteParam(
        req.params.code
      );


    const row =
      await updateService(
        code,
        req.body ??
        {}
      );


    res.json({
      success:
        true,

      message:
        "Cập nhật DVKT thành công.",

      data:
        row,
    });

  } catch (
    error
  ) {

    res.status(
      400
    ).json({
      success:
        false,

      message:
        error instanceof
        Error
          ? error.message
          : "Không thể cập nhật DVKT.",
    });
  }
}


// ======================================================
// DISABLE DVKT
// ======================================================

export async function removeService(
  req:
    Request,

  res:
    Response
) {

  try {

    const code =
      getRouteParam(
        req.params.code
      );


    await deleteService(
      code
    );


    res.json({
      success:
        true,

      message:
        "Đã ngừng sử dụng DVKT.",
    });

  } catch (
    error
  ) {

    res.status(
      400
    ).json({
      success:
        false,

      message:
        error instanceof
        Error
          ? error.message
          : "Không thể ngừng DVKT.",
    });
  }
}


// ======================================================
// DEPARTMENT / KHOA CONTROLLERS
// ======================================================


// ======================================================
// LIST DEPARTMENTS
// ======================================================

export async function getDepartments(
  req:
    Request,

  res:
    Response
) {

  try {

    const page =
      getPage(
        req.query.page
      );


    const pageSize =
      getPageSize(
        req.query.pageSize
      );


    const active =
      getActiveQuery(
        req.query.active
      );


    const code =
      getQueryText(
        req.query.code
      );


    const name =
      getQueryText(
        req.query.name
      );


    const result =
      await listDepartments({
        code:
          code ||
          undefined,

        name:
          name ||
          undefined,

        active,

        limit:
          pageSize,

        offset:
          (
            page -
            1
          ) *
          pageSize,
      });


    res.status(
      200
    ).json({
      success:
        true,

      data: {
        items:
          result.items,

        total:
          result.total,

        page,

        pageSize,
      },
    });

  } catch (
    error
  ) {

    console.error(
      "Get departments error:",
      error
    );


    res.status(
      500
    ).json({
      success:
        false,

      message:
        error instanceof
        Error
          ? error.message
          : "Không thể tải danh mục khoa.",
    });
  }
}


// ======================================================
// GET ONE DEPARTMENT
// ======================================================

export async function getDepartmentByCode(
  req:
    Request,

  res:
    Response
) {

  try {

    const code =
      getRouteParam(
        req.params.code
      );


    const result =
      await getDepartment(
        code
      );


    if (
      !result
    ) {

      res.status(
        404
      ).json({
        success:
          false,

        message:
          "Không tìm thấy khoa.",
      });

      return;
    }


    res.status(
      200
    ).json({
      success:
        true,

      data:
        result,
    });

  } catch (
    error
  ) {

    res.status(
      400
    ).json({
      success:
        false,

      message:
        error instanceof
        Error
          ? error.message
          : "Không thể tải thông tin khoa.",
    });
  }
}


// ======================================================
// CREATE DEPARTMENT
// ======================================================

export async function addDepartment(
  req:
    Request,

  res:
    Response
) {

  try {

    const result =
      await createDepartment(
        req.body ??
        {}
      );


    res.status(
      201
    ).json({
      success:
        true,

      message:
        "Thêm khoa thành công.",

      data:
        result,
    });

  } catch (
    error
  ) {

    res.status(
      400
    ).json({
      success:
        false,

      message:
        error instanceof
        Error
          ? error.message
          : "Không thể thêm khoa.",
    });
  }
}


// ======================================================
// UPDATE DEPARTMENT
// ======================================================

export async function editDepartment(
  req:
    Request,

  res:
    Response
) {

  try {

    const code =
      getRouteParam(
        req.params.code
      );


    const result =
      await updateDepartment(
        code,
        req.body ??
        {}
      );


    res.status(
      200
    ).json({
      success:
        true,

      message:
        "Cập nhật khoa thành công.",

      data:
        result,
    });

  } catch (
    error
  ) {

    res.status(
      400
    ).json({
      success:
        false,

      message:
        error instanceof
        Error
          ? error.message
          : "Không thể cập nhật khoa.",
    });
  }
}


// ======================================================
// DISABLE DEPARTMENT
// ======================================================

export async function removeDepartment(
  req:
    Request,

  res:
    Response
) {

  try {

    const code =
      getRouteParam(
        req.params.code
      );


    await deleteDepartment(
      code
    );


    res.status(
      200
    ).json({
      success:
        true,

      message:
        "Đã ngừng sử dụng khoa.",
    });

  } catch (
    error
  ) {

    res.status(
      400
    ).json({
      success:
        false,

      message:
        error instanceof
        Error
          ? error.message
          : "Không thể ngừng sử dụng khoa.",
    });
  }
}


// ======================================================
// MEDICAL STAFF CONTROLLERS
// ======================================================


// ======================================================
// LIST MEDICAL STAFF
// ======================================================

export async function getMedicalStaffList(
  req:
    Request,

  res:
    Response
) {

  try {

    const page =
      getPage(
        req.query.page
      );


    const pageSize =
      getPageSize(
        req.query.pageSize
      );


    const active =
      getActiveQuery(
        req.query.active
      );


    const fullName =
      getQueryText(
        req.query.fullName
      );


    const socialInsuranceCode =
      getQueryText(
        req.query.socialInsuranceCode
      );


    const licenseNumber =
      getQueryText(
        req.query.licenseNumber
      );


    const departmentCode =
      getQueryText(
        req.query.departmentCode
      );


    const result =
      await listMedicalStaff({
        fullName:
          fullName ||
          undefined,

        socialInsuranceCode:
          socialInsuranceCode ||
          undefined,

        licenseNumber:
          licenseNumber ||
          undefined,

        departmentCode:
          departmentCode ||
          undefined,

        active,

        limit:
          pageSize,

        offset:
          (
            page -
            1
          ) *
          pageSize,
      });


    res.status(
      200
    ).json({
      success:
        true,

      data: {
        items:
          result.items,

        total:
          result.total,

        page,

        pageSize,
      },
    });

  } catch (
    error
  ) {

    console.error(
      "Get medical staff error:",
      error
    );


    res.status(
      500
    ).json({
      success:
        false,

      message:
        error instanceof
        Error
          ? error.message
          : "Không thể tải danh mục nhân viên y tế.",
    });
  }
}


// ======================================================
// GET ONE MEDICAL STAFF
// ======================================================

export async function getMedicalStaffById(
  req:
    Request,

  res:
    Response
) {

  try {

    const id =
      getRouteParam(
        req.params.id
      );


    const result =
      await getMedicalStaff(
        id
      );


    if (
      !result
    ) {

      res.status(
        404
      ).json({
        success:
          false,

        message:
          "Không tìm thấy nhân viên y tế.",
      });

      return;
    }


    res.status(
      200
    ).json({
      success:
        true,

      data:
        result,
    });

  } catch (
    error
  ) {

    res.status(
      400
    ).json({
      success:
        false,

      message:
        error instanceof
        Error
          ? error.message
          : "Không thể tải nhân viên y tế.",
    });
  }
}


// ======================================================
// CREATE MEDICAL STAFF
// ======================================================

export async function addMedicalStaff(
  req:
    Request,

  res:
    Response
) {

  try {

    const result =
      await createMedicalStaff(
        req.body ??
        {}
      );


    res.status(
      201
    ).json({
      success:
        true,

      message:
        "Thêm nhân viên y tế thành công.",

      data:
        result,
    });

  } catch (
    error
  ) {

    res.status(
      400
    ).json({
      success:
        false,

      message:
        error instanceof
        Error
          ? error.message
          : "Không thể thêm nhân viên y tế.",
    });
  }
}


// ======================================================
// UPDATE MEDICAL STAFF
// ======================================================

export async function editMedicalStaff(
  req:
    Request,

  res:
    Response
) {

  try {

    const id =
      getRouteParam(
        req.params.id
      );


    const result =
      await updateMedicalStaff(
        id,
        req.body ??
        {}
      );


    res.status(
      200
    ).json({
      success:
        true,

      message:
        "Cập nhật nhân viên y tế thành công.",

      data:
        result,
    });

  } catch (
    error
  ) {

    res.status(
      400
    ).json({
      success:
        false,

      message:
        error instanceof
        Error
          ? error.message
          : "Không thể cập nhật nhân viên y tế.",
    });
  }
}


// ======================================================
// DISABLE MEDICAL STAFF
// ======================================================

export async function removeMedicalStaff(
  req:
    Request,

  res:
    Response
) {

  try {

    const id =
      getRouteParam(
        req.params.id
      );


    await deleteMedicalStaff(
      id
    );


    res.status(
      200
    ).json({
      success:
        true,

      message:
        "Đã ngừng sử dụng nhân viên y tế.",
    });

  } catch (
    error
  ) {

    res.status(
      400
    ).json({
      success:
        false,

      message:
        error instanceof
        Error
          ? error.message
          : "Không thể ngừng sử dụng nhân viên y tế.",
    });
  }
}


// ======================================================
// DRUG CONTROLLERS
// ======================================================


// ======================================================
// LIST DRUGS
// ======================================================

export async function getDrugs(
  req:
    Request,

  res:
    Response
) {

  try {

    const page =
      getPage(
        req.query.page
      );


    const pageSize =
      getPageSize(
        req.query.pageSize
      );


    const active =
      getActiveQuery(
        req.query.active
      );


    const code =
      getQueryText(
        req.query.code
      );


    const name =
      getQueryText(
        req.query.name
      );


    const activeIngredient =
      getQueryText(
        req.query.activeIngredient
      );


    const groupCode =
      getQueryText(
        req.query.groupCode
      );


    const result =
      await listDrugs({
        code:
          code ||
          undefined,

        name:
          name ||
          undefined,

        activeIngredient:
          activeIngredient ||
          undefined,

        groupCode:
          groupCode ||
          undefined,

        active,

        limit:
          pageSize,

        offset:
          (
            page -
            1
          ) *
          pageSize,
      });


    res.status(
      200
    ).json({
      success:
        true,

      data: {
        items:
          result.items,

        total:
          result.total,

        page,

        pageSize,
      },
    });

  } catch (
    error
  ) {

    console.error(
      "Get drugs error:",
      error
    );


    res.status(
      500
    ).json({
      success:
        false,

      message:
        error instanceof
        Error
          ? error.message
          : "Không thể tải danh mục thuốc.",
    });
  }
}


// ======================================================
// GET ONE DRUG
// ======================================================

export async function getDrugByCode(
  req:
    Request,

  res:
    Response
) {

  try {

    const code =
      getRouteParam(
        req.params.code
      );


    const result =
      await getDrug(
        code
      );


    if (
      !result
    ) {

      res.status(
        404
      ).json({
        success:
          false,

        message:
          "Không tìm thấy thuốc.",
      });

      return;
    }


    res.status(
      200
    ).json({
      success:
        true,

      data:
        result,
    });

  } catch (
    error
  ) {

    res.status(
      400
    ).json({
      success:
        false,

      message:
        error instanceof
        Error
          ? error.message
          : "Không thể tải thuốc.",
    });
  }
}


// ======================================================
// CREATE DRUG
// ======================================================

export async function addDrug(
  req:
    Request,

  res:
    Response
) {

  try {

    const result =
      await createDrug(
        req.body ??
        {}
      );


    res.status(
      201
    ).json({
      success:
        true,

      message:
        "Thêm thuốc thành công.",

      data:
        result,
    });

  } catch (
    error
  ) {

    res.status(
      400
    ).json({
      success:
        false,

      message:
        error instanceof
        Error
          ? error.message
          : "Không thể thêm thuốc.",
    });
  }
}


// ======================================================
// UPDATE DRUG
// ======================================================

export async function editDrug(
  req:
    Request,

  res:
    Response
) {

  try {

    const code =
      getRouteParam(
        req.params.code
      );


    const result =
      await updateDrug(
        code,
        req.body ??
        {}
      );


    res.status(
      200
    ).json({
      success:
        true,

      message:
        "Cập nhật thuốc thành công.",

      data:
        result,
    });

  } catch (
    error
  ) {

    res.status(
      400
    ).json({
      success:
        false,

      message:
        error instanceof
        Error
          ? error.message
          : "Không thể cập nhật thuốc.",
    });
  }
}


// ======================================================
// DISABLE DRUG
// ======================================================

export async function removeDrug(
  req:
    Request,

  res:
    Response
) {

  try {

    const code =
      getRouteParam(
        req.params.code
      );


    await deleteDrug(
      code
    );


    res.status(
      200
    ).json({
      success:
        true,

      message:
        "Đã ngừng sử dụng thuốc.",
    });

  } catch (
    error
  ) {

    res.status(
      400
    ).json({
      success:
        false,

      message:
        error instanceof
        Error
          ? error.message
          : "Không thể ngừng sử dụng thuốc.",
    });
  }
}