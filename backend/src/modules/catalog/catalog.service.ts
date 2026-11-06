import { db } from "../../config/database.js";
import type { PoolClient } from "pg";

// ======================================================
// RULE CATALOG
// ======================================================

export type CatalogType =
  | "service-icd"
  | "service-diagnosis"
  | "service-staff"
  | "drug-icd"
  | "drug-icd-interactions"
  | "drug-ingredient"
  | "drug-interaction";

interface CatalogSpec {
  table: string;
  columns: string[];
  required: string[];
}

const SPECS: Record<CatalogType, CatalogSpec> = {
  "service-icd": {
    table: "catalog.service_icd_rules",
    columns: [
      "service_code",
      "icd_code",
      "match_type",
      "active",
      "note",
    ],
    required: ["service_code", "icd_code"],
  },

  "service-diagnosis": {
    table: "catalog.service_diagnosis_rules",
    columns: [
      "service_code",
      "diagnosis_pattern",
      "match_type",
      "active",
      "note",
    ],
    required: ["service_code", "diagnosis_pattern"],
  },

  "service-staff": {
    table: "catalog.service_staff_rules",
    columns: [
      "service_code",
      "staff_code",
      "specialty_code",
      "activity_type",
      "allowed",
      "active",
      "note",
    ],
    required: [
      "service_code",
      "staff_code",
      "activity_type",
    ],
  },

  "drug-icd": {
    table: "catalog.drug_icd_rules",
    columns: [
      "drug_code",
      "icd_code",
      "match_type",
      "active",
      "note",
    ],
    required: ["drug_code", "icd_code"],
  },

  "drug-icd-interactions": {
    table: "catalog.drug_icd_interactions",
    columns: [
      "active_ingredient",
      "icd_code",
      "icd_name",
      "match_type",
      "note",
      "active",
    ],
    required: [
      "active_ingredient",
      "icd_code",
      "match_type",
      "note",
    ],
  },

  "drug-ingredient": {
    table: "catalog.drug_active_ingredients",
    columns: [
      "drug_code",
      "active_ingredient",
      "active_ingredient_code",
      "active",
      "note",
    ],
    required: ["drug_code", "active_ingredient"],
  },

  "drug-interaction": {
    table: "catalog.drug_interaction_rules",
    columns: [
      "ingredient_a",
      "ingredient_b",
      "severity",
      "active",
      "description",
    ],
    required: ["ingredient_a", "ingredient_b"],
  },
};

// ======================================================
// MACHINE TYPES
// ======================================================

export interface ListMachinesParams {
  code?: string;
  name?: string;
  active?: boolean;
  limit: number;
  offset: number;
}

export interface MachineInput {
  code?: string;
  name?: string;
  warnTimeOverlap?: boolean;
  note?: string | null;
  active?: boolean;
}

// ======================================================
// HELPERS
// ======================================================

function getSpec(type: string): CatalogSpec {
  const spec = SPECS[type as CatalogType];

  if (!spec) {
    throw new Error(
      `Loại danh mục không hợp lệ: ${type}`
    );
  }

  return spec;
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

// ======================================================
// RULE CRUD
// ======================================================

export async function listCatalogRules(type: string) {
  const spec = getSpec(type);

  const result = await db.query(`
    SELECT *
    FROM ${spec.table}
    ORDER BY created_at DESC, id DESC
  `);

  return result.rows;
}

export async function createCatalogRule(
  type: string,
  data: Record<string, unknown>
) {
  const spec = getSpec(type);

  for (const field of spec.required) {
    if (
      data[field] === undefined ||
      data[field] === null ||
      String(data[field]).trim() === ""
    ) {
      throw new Error(
        `Thiếu trường bắt buộc: ${field}`
      );
    }
  }

  const columns = spec.columns.filter(
    column => data[column] !== undefined
  );

  if (columns.length === 0) {
    throw new Error("Không có dữ liệu để thêm.");
  }

  const values = columns.map(
    column => data[column]
  );

  const placeholders = columns.map(
    (_, index) => `$${index + 1}`
  );

  const result = await db.query(
    `
    INSERT INTO ${spec.table}
      (${columns.join(", ")})
    VALUES
      (${placeholders.join(", ")})
    RETURNING *
    `,
    values
  );

  return result.rows[0];
}

export async function updateCatalogRule(
  type: string,
  id: string,
  data: Record<string, unknown>
) {
  const spec = getSpec(type);

  const columns = spec.columns.filter(
    column => data[column] !== undefined
  );

  if (columns.length === 0) {
    throw new Error("Không có dữ liệu cập nhật.");
  }

  const values = columns.map(
    column => data[column]
  );

  const sets = columns.map(
    (column, index) => `${column} = $${index + 1}`
  );

  values.push(id);

  const result = await db.query(
    `
    UPDATE ${spec.table}
    SET
      ${sets.join(", ")},
      updated_at = NOW()
    WHERE id = $${values.length}
    RETURNING *
    `,
    values
  );

  if (result.rowCount === 0) {
    throw new Error("Không tìm thấy dữ liệu.");
  }

  return result.rows[0];
}

export async function deleteCatalogRule(
  type: string,
  id: string
) {
  const spec = getSpec(type);

  const result = await db.query(
    `
    DELETE FROM ${spec.table}
    WHERE id = $1
    RETURNING id
    `,
    [id]
  );

  if (result.rowCount === 0) {
    throw new Error("Không tìm thấy dữ liệu.");
  }

  return true;
}

// ======================================================
// MACHINE CRUD
// ======================================================

export async function listMachines(
  params: ListMachinesParams
) {
  const {
    code,
    name,
    active,
    limit,
    offset,
  } = params;

  const conditions: string[] = [];
  const values: unknown[] = [];

  if (code) {
    values.push(`%${code}%`);
    conditions.push(
      `m.code ILIKE $${values.length}`
    );
  }

  if (name) {
    values.push(`%${name}%`);
    conditions.push(
      `COALESCE(m.name, '') ILIKE $${values.length}`
    );
  }

  if (active !== undefined) {
    values.push(active);
    conditions.push(
      `m.active = $${values.length}`
    );
  }

  const whereSql = conditions.length > 0
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  const dataValues = [
    ...values,
    limit,
    offset,
  ];

  const limitIndex = values.length + 1;
  const offsetIndex = values.length + 2;

  const result = await db.query(
    `
    SELECT
      m.code,
      m.name,
      m.service_code,
      m.warn_time_overlap,
      m.note,
      m.active,
      m.created_at,
      m.updated_at,
      COUNT(sm.service_code)::integer AS service_count
    FROM catalog.machines m
    LEFT JOIN catalog.service_machines sm
      ON sm.machine_code = m.code
      AND sm.active = true
    ${whereSql}
    GROUP BY
      m.code,
      m.name,
      m.service_code,
      m.warn_time_overlap,
      m.note,
      m.active,
      m.created_at,
      m.updated_at
    ORDER BY
      m.name ASC NULLS LAST,
      m.code ASC
    LIMIT $${limitIndex}
    OFFSET $${offsetIndex}
    `,
    dataValues
  );

  const countResult = await db.query(
    `
    SELECT COUNT(*)::integer AS total
    FROM catalog.machines m
    ${whereSql}
    `,
    values
  );

  return {
    items: result.rows.map(row => ({
      code: String(row.code),
      name: row.name ? String(row.name) : "",
      legacyServiceCode: row.service_code
        ? String(row.service_code)
        : null,
      warnTimeOverlap: Boolean(
        row.warn_time_overlap
      ),
      note: row.note ? String(row.note) : null,
      active: Boolean(row.active),
      serviceCount: Number(
        row.service_count ?? 0
      ),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),

    total: Number(
      countResult.rows[0]?.total ?? 0
    ),
  };
}

export async function getMachine(code: string) {
  const normalizedCode = normalizeText(code);

  if (!normalizedCode) {
    throw new Error("Thiếu mã máy.");
  }

  const result = await db.query(
    `
    SELECT
      m.code,
      m.name,
      m.service_code,
      m.warn_time_overlap,
      m.note,
      m.active,
      m.created_at,
      m.updated_at,
      COALESCE(
        json_agg(
          json_build_object(
            'serviceCode', sm.service_code,
            'serviceName', s.name
          )
          ORDER BY s.name, sm.service_code
        )
        FILTER (
          WHERE sm.service_code IS NOT NULL
        ),
        '[]'::json
      ) AS services
    FROM catalog.machines m
    LEFT JOIN catalog.service_machines sm
      ON sm.machine_code = m.code
      AND sm.active = true
    LEFT JOIN catalog.services s
      ON s.code = sm.service_code
    WHERE m.code = $1
    GROUP BY
      m.code,
      m.name,
      m.service_code,
      m.warn_time_overlap,
      m.note,
      m.active,
      m.created_at,
      m.updated_at
    `,
    [normalizedCode]
  );

  if (result.rowCount === 0) {
    return null;
  }

  const row = result.rows[0];

  return {
    code: String(row.code),
    name: row.name ? String(row.name) : "",
    legacyServiceCode: row.service_code
      ? String(row.service_code)
      : null,
    warnTimeOverlap: Boolean(
      row.warn_time_overlap
    ),
    note: row.note ? String(row.note) : null,
    active: Boolean(row.active),
    services: Array.isArray(row.services)
      ? row.services
      : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createMachine(
  data: MachineInput
) {
  const code = normalizeText(data.code);
  const name = normalizeText(data.name);

  if (!code) {
    throw new Error("Vui lòng nhập mã máy.");
  }

  if (!name) {
    throw new Error("Vui lòng nhập tên máy.");
  }

  const existing = await db.query(
    `
    SELECT code
    FROM catalog.machines
    WHERE code = $1
    LIMIT 1
    `,
    [code]
  );

  if (
    existing.rowCount &&
    existing.rowCount > 0
  ) {
    throw new Error(
      `Mã máy "${code}" đã tồn tại.`
    );
  }

  const result = await db.query(
    `
    INSERT INTO catalog.machines (
      code,
      name,
      warn_time_overlap,
      note,
      active,
      created_at,
      updated_at
    )
    VALUES (
      $1, $2, $3, $4, $5, NOW(), NOW()
    )
    RETURNING
      code,
      name,
      warn_time_overlap,
      note,
      active,
      created_at,
      updated_at
    `,
    [
      code,
      name,
      data.warnTimeOverlap ?? false,
      data.note
        ? normalizeText(data.note)
        : null,
      data.active ?? true,
    ]
  );

  const row = result.rows[0];

  return {
    code: row.code,
    name: row.name,
    warnTimeOverlap: row.warn_time_overlap,
    note: row.note,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function updateMachine(
  oldCode: string,
  data: MachineInput
) {
  const normalizedOldCode =
    normalizeText(oldCode);

  if (!normalizedOldCode) {
    throw new Error(
      "Thiếu mã máy cần cập nhật."
    );
  }

  const currentResult = await db.query(
    `
    SELECT
      code,
      name,
      warn_time_overlap,
      note,
      active
    FROM catalog.machines
    WHERE code = $1
    LIMIT 1
    `,
    [normalizedOldCode]
  );

  if (currentResult.rowCount === 0) {
    throw new Error("Không tìm thấy máy.");
  }

  const current = currentResult.rows[0];

  const newCode = data.code !== undefined
    ? normalizeText(data.code)
    : String(current.code);

  const newName = data.name !== undefined
    ? normalizeText(data.name)
    : String(current.name ?? "");

  if (!newCode) {
    throw new Error(
      "Mã máy không được để trống."
    );
  }

  if (!newName) {
    throw new Error(
      "Tên máy không được để trống."
    );
  }

  if (newCode !== normalizedOldCode) {
    const duplicate = await db.query(
      `
      SELECT code
      FROM catalog.machines
      WHERE code = $1
      LIMIT 1
      `,
      [newCode]
    );

    if (
      duplicate.rowCount &&
      duplicate.rowCount > 0
    ) {
      throw new Error(
        `Mã máy "${newCode}" đã tồn tại.`
      );
    }
  }

  const warnTimeOverlap =
    data.warnTimeOverlap !== undefined
      ? Boolean(data.warnTimeOverlap)
      : Boolean(current.warn_time_overlap);

  const note = data.note !== undefined
    ? (
      data.note
        ? normalizeText(data.note)
        : null
    )
    : current.note;

  const active = data.active !== undefined
    ? Boolean(data.active)
    : Boolean(current.active);

  const result = await db.query(
    `
    UPDATE catalog.machines
    SET
      code = $2,
      name = $3,
      warn_time_overlap = $4,
      note = $5,
      active = $6,
      updated_at = NOW()
    WHERE code = $1
    RETURNING
      code,
      name,
      warn_time_overlap,
      note,
      active,
      created_at,
      updated_at
    `,
    [
      normalizedOldCode,
      newCode,
      newName,
      warnTimeOverlap,
      note,
      active,
    ]
  );

  const row = result.rows[0];

  return {
    code: row.code,
    name: row.name,
    warnTimeOverlap: row.warn_time_overlap,
    note: row.note,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function deleteMachine(
  code: string
) {
  const normalizedCode = normalizeText(code);

  if (!normalizedCode) {
    throw new Error("Thiếu mã máy.");
  }

  const result = await db.query(
    `
    UPDATE catalog.machines
    SET
      active = false,
      updated_at = NOW()
    WHERE code = $1
    RETURNING code
    `,
    [normalizedCode]
  );

  if (result.rowCount === 0) {
    throw new Error("Không tìm thấy máy.");
  }

  return true;
}

// ======================================================
// SERVICE TYPES
// ======================================================

export interface ListServicesParams {
  code?: string;
  name?: string;
  groupCode?: string;
  active?: boolean;
  limit: number;
  offset: number;
}

export interface ServiceInput {
  code?: string;
  name?: string;
  groupCode?: string | null;
  unitPrice?: number;
  decisionNo?: string | null;
  requiresResult?: boolean;
  requiresMachine?: boolean;
  allowSimultaneous?: boolean;
  minDurationMinutes?: number;
  maxDurationMinutes?: number;
  nextExecutionDays?: number;
  note?: string | null;
  active?: boolean;
  machineCodes?: string[];
}

// ======================================================
// SERVICE CRUD
// ======================================================

export async function listServices(
  params: ListServicesParams
) {
  const {
    code,
    name,
    groupCode,
    active,
    limit,
    offset,
  } = params;

  const conditions: string[] = [];
  const values: unknown[] = [];

  if (code) {
    values.push(`%${code}%`);
    conditions.push(
      `s.code ILIKE $${values.length}`
    );
  }

  if (name) {
    values.push(`%${name}%`);
    conditions.push(
      `s.name ILIKE $${values.length}`
    );
  }

  if (groupCode) {
    values.push(groupCode);
    conditions.push(
      `s.group_code = $${values.length}`
    );
  }

  if (active !== undefined) {
    values.push(active);
    conditions.push(
      `s.active = $${values.length}`
    );
  }

  const whereSql = conditions.length > 0
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  const limitIndex = values.length + 1;
  const offsetIndex = values.length + 2;

  const result = await db.query(
    `
    SELECT
      s.code,
      s.name,
      s.group_code,
      s.unit_price,
      s.decision_no,
      s.requires_result,
      s.requires_machine,
      s.allow_simultaneous,
      s.min_duration_minutes,
      s.max_duration_minutes,
      s.next_execution_days,
      s.note,
      s.active,
      s.created_at,
      s.updated_at,
      COALESCE(
        (
          SELECT json_agg(
            json_build_object(
              'code', m.code,
              'name', m.name,
              'warnTimeOverlap', m.warn_time_overlap
            )
            ORDER BY m.name, m.code
          )
          FROM catalog.service_machines sm
          INNER JOIN catalog.machines m
            ON m.code = sm.machine_code
          WHERE sm.service_code = s.code
            AND sm.active = true
        ),
        '[]'::json
      ) AS machines
    FROM catalog.services s
    ${whereSql}
    ORDER BY s.name ASC, s.code ASC
    LIMIT $${limitIndex}
    OFFSET $${offsetIndex}
    `,
    [...values, limit, offset]
  );

  const countResult = await db.query(
    `
    SELECT COUNT(*)::integer AS total
    FROM catalog.services s
    ${whereSql}
    `,
    values
  );

  return {
    items: result.rows.map(row => {
      const machines =
        Array.isArray(row.machines)
          ? row.machines
          : [];

      return {
        code: String(row.code),
        name: String(row.name),
        groupCode: row.group_code
          ? String(row.group_code)
          : null,
        unitPrice: Number(
          row.unit_price ?? 0
        ),
        decisionNo: row.decision_no
          ? String(row.decision_no)
          : null,
        requiresResult: Boolean(
          row.requires_result
        ),
        requiresMachine: Boolean(
          row.requires_machine
        ),
        allowSimultaneous: Boolean(
          row.allow_simultaneous
        ),
        minDurationMinutes: Number(
          row.min_duration_minutes ?? 0
        ),
        maxDurationMinutes: Number(
          row.max_duration_minutes ?? 0
        ),
        nextExecutionDays: Number(
          row.next_execution_days ?? 0
        ),
        note: row.note
          ? String(row.note)
          : null,
        active: Boolean(row.active),
        machines,
        machineCount: machines.length,
      };
    }),

    total: Number(
      countResult.rows[0]?.total ?? 0
    ),
  };
}

export async function getService(
  code: string
) {
  const normalizedCode =
    String(code ?? "").trim();

  const result = await db.query(
    `
    SELECT
      s.*,
      COALESCE(
        json_agg(
          json_build_object(
            'code', m.code,
            'name', m.name,
            'warnTimeOverlap', m.warn_time_overlap
          )
          ORDER BY m.name, m.code
        )
        FILTER (WHERE m.code IS NOT NULL),
        '[]'::json
      ) AS machines
    FROM catalog.services s
    LEFT JOIN catalog.service_machines sm
      ON sm.service_code = s.code
      AND sm.active = true
    LEFT JOIN catalog.machines m
      ON m.code = sm.machine_code
    WHERE s.code = $1
    GROUP BY s.code
    `,
    [normalizedCode]
  );

  if (result.rowCount === 0) {
    return null;
  }

  const row = result.rows[0];

  return {
    code: row.code,
    name: row.name,
    groupCode: row.group_code,
    unitPrice: Number(row.unit_price ?? 0),
    decisionNo: row.decision_no,
    requiresResult: Boolean(
      row.requires_result
    ),
    requiresMachine: Boolean(
      row.requires_machine
    ),
    allowSimultaneous: Boolean(
      row.allow_simultaneous
    ),
    minDurationMinutes: Number(
      row.min_duration_minutes ?? 0
    ),
    maxDurationMinutes: Number(
      row.max_duration_minutes ?? 0
    ),
    nextExecutionDays: Number(
      row.next_execution_days ?? 0
    ),
    note: row.note,
    active: Boolean(row.active),
    machines: Array.isArray(row.machines)
      ? row.machines
      : [],
  };
}

function validateServiceInput(
  data: ServiceInput
) {
  const code =
    String(data.code ?? "").trim();

  const name =
    String(data.name ?? "").trim();

  if (!code) {
    throw new Error(
      "Vui lòng nhập mã dịch vụ."
    );
  }

  if (!name) {
    throw new Error(
      "Vui lòng nhập tên dịch vụ."
    );
  }

  const unitPrice =
    Number(data.unitPrice ?? 0);

  const min =
    Number(data.minDurationMinutes ?? 0);

  const max =
    Number(data.maxDurationMinutes ?? 0);

  const nextDays =
    Number(data.nextExecutionDays ?? 0);

  const requiresMachine = Boolean(
    data.requiresMachine ?? false
  );

  const machineCodes =
    Array.isArray(data.machineCodes)
      ? [
        ...new Set(
          data.machineCodes
            .map(item =>
              String(item ?? "").trim()
            )
            .filter(Boolean)
        ),
      ]
      : [];

  if (unitPrice < 0) {
    throw new Error(
      "Đơn giá không được nhỏ hơn 0."
    );
  }

  if (min < 0 || max < 0) {
    throw new Error(
      "Thời gian thực hiện không được nhỏ hơn 0."
    );
  }

  if (max > 0 && max < min) {
    throw new Error(
      "Max thời gian phải lớn hơn hoặc bằng Min."
    );
  }

  if (nextDays < 0) {
    throw new Error(
      "Số ngày thực hiện tiếp theo không hợp lệ."
    );
  }

  if (
    requiresMachine &&
    machineCodes.length === 0
  ) {
    throw new Error(
      "DVKT bắt buộc mã máy nên phải chọn ít nhất 1 máy."
    );
  }

  return {
    code,
    name,
    unitPrice,
    min,
    max,
    nextDays,
    requiresMachine,
    machineCodes,
  };
}

async function replaceServiceMachines(
  client: PoolClient,
  serviceCode: string,
  machineCodes: string[]
) {
  await client.query(
    `
    DELETE FROM catalog.service_machines
    WHERE service_code = $1
    `,
    [serviceCode]
  );

  const uniqueCodes = [
    ...new Set(
      machineCodes
        .map(code => String(code).trim())
        .filter(Boolean)
    ),
  ];

  for (const machineCode of uniqueCodes) {
    const machineResult = await client.query(
      `
      SELECT code
      FROM catalog.machines
      WHERE code = $1
        AND active = true
      LIMIT 1
      `,
      [machineCode]
    );

    if (machineResult.rowCount === 0) {
      throw new Error(
        `Không tìm thấy mã máy: ${machineCode}`
      );
    }

    await client.query(
      `
      INSERT INTO catalog.service_machines (
        service_code,
        machine_code,
        active,
        created_at,
        updated_at
      )
      VALUES (
        $1, $2, true, NOW(), NOW()
      )
      `,
      [serviceCode, machineCode]
    );
  }
}

export async function createService(
  data: ServiceInput
) {
  const validated =
    validateServiceInput(data);

  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const duplicate = await client.query(
      `
      SELECT code
      FROM catalog.services
      WHERE code = $1
      LIMIT 1
      `,
      [validated.code]
    );

    if (
      duplicate.rowCount &&
      duplicate.rowCount > 0
    ) {
      throw new Error(
        `Mã dịch vụ "${validated.code}" đã tồn tại.`
      );
    }

    await client.query(
      `
      INSERT INTO catalog.services (
        code,
        name,
        group_code,
        unit_price,
        decision_no,
        requires_result,
        requires_machine,
        allow_simultaneous,
        min_duration_minutes,
        max_duration_minutes,
        next_execution_days,
        note,
        active,
        created_at,
        updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13, NOW(), NOW()
      )
      `,
      [
        validated.code,
        validated.name,
        data.groupCode || null,
        validated.unitPrice,
        data.decisionNo || null,
        data.requiresResult ?? false,
        validated.requiresMachine,
        data.allowSimultaneous ?? false,
        validated.min,
        validated.max,
        validated.nextDays,
        data.note || null,
        data.active ?? true,
      ]
    );

    await replaceServiceMachines(
      client,
      validated.code,
      validated.machineCodes
    );

    await client.query("COMMIT");

    return await getService(
      validated.code
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateService(
  oldCode: string,
  data: ServiceInput
) {
  const validated =
    validateServiceInput(data);

  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const current = await client.query(
      `
      SELECT code
      FROM catalog.services
      WHERE code = $1
      LIMIT 1
      `,
      [oldCode]
    );

    if (current.rowCount === 0) {
      throw new Error(
        "Không tìm thấy DVKT."
      );
    }

    if (validated.code !== oldCode) {
      const duplicate = await client.query(
        `
        SELECT code
        FROM catalog.services
        WHERE code = $1
        LIMIT 1
        `,
        [validated.code]
      );

      if (
        duplicate.rowCount &&
        duplicate.rowCount > 0
      ) {
        throw new Error(
          `Mã dịch vụ "${validated.code}" đã tồn tại.`
        );
      }
    }

    await client.query(
      `
      UPDATE catalog.services
      SET
        code = $2,
        name = $3,
        group_code = $4,
        unit_price = $5,
        decision_no = $6,
        requires_result = $7,
        requires_machine = $8,
        allow_simultaneous = $9,
        min_duration_minutes = $10,
        max_duration_minutes = $11,
        next_execution_days = $12,
        note = $13,
        active = $14,
        updated_at = NOW()
      WHERE code = $1
      `,
      [
        oldCode,
        validated.code,
        validated.name,
        data.groupCode || null,
        validated.unitPrice,
        data.decisionNo || null,
        data.requiresResult ?? false,
        data.requiresMachine ?? false,
        data.allowSimultaneous ?? false,
        validated.min,
        validated.max,
        validated.nextDays,
        data.note || null,
        data.active ?? true,
      ]
    );

    await replaceServiceMachines(
      client,
      validated.code,
      data.machineCodes ?? []
    );

    await client.query("COMMIT");

    return await getService(
      validated.code
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteService(
  code: string
) {
  const result = await db.query(
    `
    UPDATE catalog.services
    SET
      active = false,
      updated_at = NOW()
    WHERE code = $1
    RETURNING code
    `,
    [code]
  );

  if (result.rowCount === 0) {
    throw new Error(
      "Không tìm thấy DVKT."
    );
  }

  return true;
}

// ======================================================
// DEPARTMENT TYPES
// ======================================================

export interface ListDepartmentsParams {
  code?: string;
  name?: string;
  active?: boolean;
  limit: number;
  offset: number;
}

export interface DepartmentInput {
  code?: string;
  name?: string;
  description?: string | null;
  active?: boolean;
}

// ======================================================
// DEPARTMENT CRUD
// ======================================================

export async function listDepartments(
  params: ListDepartmentsParams
) {
  const {
    code,
    name,
    active,
    limit,
    offset,
  } = params;

  const conditions: string[] = [];
  const values: unknown[] = [];

  if (code) {
    values.push(
      `%${normalizeText(code)}%`
    );

    conditions.push(
      `d.code ILIKE $${values.length}`
    );
  }

  if (name) {
    values.push(
      `%${normalizeText(name)}%`
    );

    conditions.push(
      `d.name ILIKE $${values.length}`
    );
  }

  if (active !== undefined) {
    values.push(active);

    conditions.push(
      `d.active = $${values.length}`
    );
  }

  const whereSql = conditions.length > 0
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  const limitIndex = values.length + 1;
  const offsetIndex = values.length + 2;

  const result = await db.query(
    `
    SELECT
      d.code,
      d.name,
      d.description,
      d.active,
      d.created_at,
      d.updated_at
    FROM catalog.departments d
    ${whereSql}
    ORDER BY d.name ASC, d.code ASC
    LIMIT $${limitIndex}
    OFFSET $${offsetIndex}
    `,
    [...values, limit, offset]
  );

  const countResult = await db.query(
    `
    SELECT COUNT(*)::integer AS total
    FROM catalog.departments d
    ${whereSql}
    `,
    values
  );

  return {
    items: result.rows.map(row => ({
      code: String(row.code),
      name: String(row.name),
      description: row.description
        ? String(row.description)
        : null,
      active: Boolean(row.active),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),

    total: Number(
      countResult.rows[0]?.total ?? 0
    ),
  };
}

export async function getDepartment(
  code: string
) {
  const normalizedCode =
    normalizeText(code);

  if (!normalizedCode) {
    throw new Error("Thiếu mã khoa.");
  }

  const result = await db.query(
    `
    SELECT
      code,
      name,
      description,
      active,
      created_at,
      updated_at
    FROM catalog.departments
    WHERE code = $1
    LIMIT 1
    `,
    [normalizedCode]
  );

  if (result.rowCount === 0) {
    return null;
  }

  const row = result.rows[0];

  return {
    code: String(row.code),
    name: String(row.name),
    description: row.description
      ? String(row.description)
      : null,
    active: Boolean(row.active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function validateDepartmentInput(
  data: DepartmentInput
) {
  const code = normalizeText(data.code);
  const name = normalizeText(data.name);

  if (!code) {
    throw new Error(
      "Vui lòng nhập mã khoa."
    );
  }

  if (!name) {
    throw new Error(
      "Vui lòng nhập tên khoa."
    );
  }

  return {
    code,
    name,
    description: data.description
      ? normalizeText(data.description)
      : null,
    active: data.active ?? true,
  };
}

export async function createDepartment(
  data: DepartmentInput
) {
  const validated =
    validateDepartmentInput(data);

  const duplicate = await db.query(
    `
    SELECT code
    FROM catalog.departments
    WHERE code = $1
    LIMIT 1
    `,
    [validated.code]
  );

  if (
    duplicate.rowCount &&
    duplicate.rowCount > 0
  ) {
    throw new Error(
      `Mã khoa "${validated.code}" đã tồn tại.`
    );
  }

  await db.query(
    `
    INSERT INTO catalog.departments (
      code,
      name,
      description,
      active,
      created_at,
      updated_at
    )
    VALUES (
      $1, $2, $3, $4, NOW(), NOW()
    )
    `,
    [
      validated.code,
      validated.name,
      validated.description,
      validated.active,
    ]
  );

  return await getDepartment(
    validated.code
  );
}

export async function updateDepartment(
  oldCode: string,
  data: DepartmentInput
) {
  const normalizedOldCode =
    normalizeText(oldCode);

  if (!normalizedOldCode) {
    throw new Error(
      "Thiếu mã khoa cần cập nhật."
    );
  }

  const validated =
    validateDepartmentInput(data);

  const current = await db.query(
    `
    SELECT code
    FROM catalog.departments
    WHERE code = $1
    LIMIT 1
    `,
    [normalizedOldCode]
  );

  if (current.rowCount === 0) {
    throw new Error(
      "Không tìm thấy khoa."
    );
  }

  if (
    validated.code !== normalizedOldCode
  ) {
    const duplicate = await db.query(
      `
      SELECT code
      FROM catalog.departments
      WHERE code = $1
      LIMIT 1
      `,
      [validated.code]
    );

    if (
      duplicate.rowCount &&
      duplicate.rowCount > 0
    ) {
      throw new Error(
        `Mã khoa "${validated.code}" đã tồn tại.`
      );
    }
  }

  await db.query(
    `
    UPDATE catalog.departments
    SET
      code = $2,
      name = $3,
      description = $4,
      active = $5,
      updated_at = NOW()
    WHERE code = $1
    `,
    [
      normalizedOldCode,
      validated.code,
      validated.name,
      validated.description,
      validated.active,
    ]
  );

  return await getDepartment(
    validated.code
  );
}

export async function deleteDepartment(
  code: string
) {
  const normalizedCode =
    normalizeText(code);

  if (!normalizedCode) {
    throw new Error("Thiếu mã khoa.");
  }

  const result = await db.query(
    `
    UPDATE catalog.departments
    SET
      active = false,
      updated_at = NOW()
    WHERE code = $1
    RETURNING code
    `,
    [normalizedCode]
  );

  if (result.rowCount === 0) {
    throw new Error(
      "Không tìm thấy khoa."
    );
  }

  return true;
}

// ======================================================
// MEDICAL STAFF TYPES
// ======================================================

export interface ListMedicalStaffParams {
  fullName?: string;
  socialInsuranceCode?: string;
  licenseNumber?: string;
  departmentCode?: string;
  active?: boolean;
  limit: number;
  offset: number;
}

export interface MedicalStaffInput {
  fullName?: string;
  socialInsuranceCode?: string | null;
  licenseNumber?: string | null;
  gender?: string | null;
  licenseIssueDate?: string | null;
  professionalTitle?: string | null;
  licenseIssuer?: string | null;
  professionalScope?: string | null;
  registrationTime?: string | null;
  dailyTime?: string | null;
  weeklyTime?: string | null;
  position?: string | null;
  note?: string | null;
  active?: boolean;
  departmentCodes?: string[];
}

// ======================================================
// MEDICAL STAFF HELPERS
// ======================================================

function formatDatabaseDateOnly(
  value: unknown
): string | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    const year = value.getFullYear();

    const month = String(
      value.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
      value.getDate()
    ).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  const text = String(value).trim();

  const match = text.match(
    /^(\d{4})-(\d{2})-(\d{2})/
  );

  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }

  return null;
}

function normalizeDateOnly(
  value: unknown
): string | null {
  const text = normalizeText(value);

  if (!text) {
    return null;
  }

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(text)
  ) {
    throw new Error(
      "Ngày cấp CCHN phải có định dạng YYYY-MM-DD."
    );
  }

  const [
    yearText,
    monthText,
    dayText,
  ] = text.split("-");

  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  const date = new Date(
    Date.UTC(year, month - 1, day)
  );

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(
      "Ngày cấp CCHN không hợp lệ."
    );
  }

  return text;
}

function validateMedicalStaffInput(
  data: MedicalStaffInput
) {
  const fullName =
    normalizeText(data.fullName);

  if (!fullName) {
    throw new Error(
      "Vui lòng nhập họ tên nhân viên y tế."
    );
  }

  const departmentCodes =
    Array.isArray(data.departmentCodes)
      ? [
        ...new Set(
          data.departmentCodes
            .map(code =>
              normalizeText(code)
            )
            .filter(Boolean)
        ),
      ]
      : [];

  return {
    fullName,

    socialInsuranceCode:
      data.socialInsuranceCode
        ? normalizeText(
          data.socialInsuranceCode
        )
        : null,

    licenseNumber: data.licenseNumber
      ? normalizeText(data.licenseNumber)
      : null,

    gender: data.gender
      ? normalizeText(data.gender)
      : null,

    licenseIssueDate:
      normalizeDateOnly(
        data.licenseIssueDate
      ),

    professionalTitle:
      data.professionalTitle
        ? normalizeText(
          data.professionalTitle
        )
        : null,

    licenseIssuer: data.licenseIssuer
      ? normalizeText(data.licenseIssuer)
      : null,

    professionalScope:
      data.professionalScope
        ? normalizeText(
          data.professionalScope
        )
        : null,

    registrationTime:
      data.registrationTime
        ? normalizeText(
          data.registrationTime
        )
        : null,

    dailyTime: data.dailyTime
      ? normalizeText(data.dailyTime)
      : null,

    weeklyTime: data.weeklyTime
      ? normalizeText(data.weeklyTime)
      : null,

    position: data.position
      ? normalizeText(data.position)
      : null,

    note: data.note
      ? normalizeText(data.note)
      : null,

    active: data.active ?? true,

    departmentCodes,
  };
}

async function replaceMedicalStaffDepartments(
  client: PoolClient,
  staffId: string,
  departmentCodes: string[]
) {
  await client.query(
    `
    UPDATE catalog.medical_staff_departments
    SET
      active = false,
      updated_at = NOW()
    WHERE staff_id = $1
      AND active = true
    `,
    [staffId]
  );

  if (departmentCodes.length === 0) {
    return;
  }

  const departmentResult =
    await client.query<{ code: string }>(
      `
      SELECT code
      FROM catalog.departments
      WHERE code = ANY($1::varchar[])
        AND active = true
      `,
      [departmentCodes]
    );

  const foundCodes = new Set(
    departmentResult.rows.map(
      row => String(row.code)
    )
  );

  const missingCodes =
    departmentCodes.filter(
      code => !foundCodes.has(code)
    );

  if (missingCodes.length > 0) {
    throw new Error(
      `Không tìm thấy khoa đang hoạt động: ${missingCodes.join(", ")}`
    );
  }

  await client.query(
    `
    INSERT INTO catalog.medical_staff_departments (
      staff_id,
      department_code,
      active,
      created_at,
      updated_at
    )
    SELECT
      $1::uuid,
      department_code,
      true,
      NOW(),
      NOW()
    FROM unnest($2::varchar[]) AS department_code
    ON CONFLICT (
      staff_id,
      department_code
    )
    DO UPDATE
    SET
      active = true,
      updated_at = NOW()
    `,
    [staffId, departmentCodes]
  );
}

// ======================================================
// MEDICAL STAFF CRUD
// ======================================================

export async function listMedicalStaff(
  params: ListMedicalStaffParams
) {
  const {
    fullName,
    socialInsuranceCode,
    licenseNumber,
    departmentCode,
    active,
    limit,
    offset,
  } = params;

  const conditions: string[] = [];
  const values: unknown[] = [];

  if (fullName) {
    values.push(
      `%${normalizeText(fullName)}%`
    );

    conditions.push(
      `s.full_name ILIKE $${values.length}`
    );
  }

  if (socialInsuranceCode) {
    values.push(
      `%${normalizeText(socialInsuranceCode)}%`
    );

    conditions.push(
      `COALESCE(s.social_insurance_code, '') ILIKE $${values.length}`
    );
  }

  if (licenseNumber) {
    values.push(
      `%${normalizeText(licenseNumber)}%`
    );

    conditions.push(
      `COALESCE(s.license_number, '') ILIKE $${values.length}`
    );
  }

  if (departmentCode) {
    values.push(
      normalizeText(departmentCode)
    );

    conditions.push(`
      EXISTS (
        SELECT 1
        FROM catalog.medical_staff_departments sd
        WHERE sd.staff_id = s.id
          AND sd.department_code = $${values.length}
          AND sd.active = true
      )
    `);
  }

  if (active !== undefined) {
    values.push(active);

    conditions.push(
      `s.active = $${values.length}`
    );
  }

  const whereSql = conditions.length > 0
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  const limitIndex = values.length + 1;
  const offsetIndex = values.length + 2;

  const result = await db.query(
    `
    SELECT
      s.id,
      s.full_name,
      s.social_insurance_code,
      s.license_number,
      s.gender,
      s.license_issue_date,
      s.professional_title,
      s.license_issuer,
      s.professional_scope,
      s.registration_time,
      s.daily_time,
      s.weekly_time,
      s.position,
      s.note,
      s.active,
      s.created_at,
      s.updated_at,
      COALESCE(
        (
          SELECT json_agg(
            json_build_object(
              'code', d.code,
              'name', d.name
            )
            ORDER BY d.name, d.code
          )
          FROM catalog.medical_staff_departments sd
          INNER JOIN catalog.departments d
            ON d.code = sd.department_code
          WHERE sd.staff_id = s.id
            AND sd.active = true
        ),
        '[]'::json
      ) AS departments
    FROM catalog.medical_staff s
    ${whereSql}
    ORDER BY s.full_name ASC, s.id ASC
    LIMIT $${limitIndex}
    OFFSET $${offsetIndex}
    `,
    [...values, limit, offset]
  );

  const countResult = await db.query(
    `
    SELECT COUNT(*)::integer AS total
    FROM catalog.medical_staff s
    ${whereSql}
    `,
    values
  );

  return {
    items: result.rows.map(row => ({
      id: String(row.id),
      fullName: String(row.full_name),

      socialInsuranceCode:
        row.social_insurance_code
          ? String(
            row.social_insurance_code
          )
          : null,

      licenseNumber: row.license_number
        ? String(row.license_number)
        : null,

      gender: row.gender
        ? String(row.gender)
        : null,

      licenseIssueDate:
        formatDatabaseDateOnly(
          row.license_issue_date
        ),

      professionalTitle:
        row.professional_title
          ? String(row.professional_title)
          : null,

      licenseIssuer: row.license_issuer
        ? String(row.license_issuer)
        : null,

      professionalScope:
        row.professional_scope
          ? String(row.professional_scope)
          : null,

      registrationTime:
        row.registration_time
          ? String(row.registration_time)
          : null,

      dailyTime: row.daily_time
        ? String(row.daily_time)
        : null,

      weeklyTime: row.weekly_time
        ? String(row.weekly_time)
        : null,

      position: row.position
        ? String(row.position)
        : null,

      note: row.note
        ? String(row.note)
        : null,

      active: Boolean(row.active),

      departments:
        Array.isArray(row.departments)
          ? row.departments
          : [],

      departmentCount:
        Array.isArray(row.departments)
          ? row.departments.length
          : 0,

      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),

    total: Number(
      countResult.rows[0]?.total ?? 0
    ),
  };
}

export async function getMedicalStaff(
  id: string
) {
  const normalizedId = normalizeText(id);

  if (!normalizedId) {
    throw new Error(
      "Thiếu ID nhân viên y tế."
    );
  }

  const result = await db.query(
    `
    SELECT
      s.id,
      s.full_name,
      s.social_insurance_code,
      s.license_number,
      s.gender,
      s.license_issue_date,
      s.professional_title,
      s.license_issuer,
      s.professional_scope,
      s.registration_time,
      s.daily_time,
      s.weekly_time,
      s.position,
      s.note,
      s.active,
      s.created_at,
      s.updated_at,
      COALESCE(
        (
          SELECT json_agg(
            json_build_object(
              'code', d.code,
              'name', d.name
            )
            ORDER BY d.name, d.code
          )
          FROM catalog.medical_staff_departments sd
          INNER JOIN catalog.departments d
            ON d.code = sd.department_code
          WHERE sd.staff_id = s.id
            AND sd.active = true
        ),
        '[]'::json
      ) AS departments
    FROM catalog.medical_staff s
    WHERE s.id = $1::uuid
    LIMIT 1
    `,
    [normalizedId]
  );

  if (result.rowCount === 0) {
    return null;
  }

  const row = result.rows[0];

  return {
    id: String(row.id),
    fullName: String(row.full_name),

    socialInsuranceCode:
      row.social_insurance_code
        ? String(row.social_insurance_code)
        : null,

    licenseNumber: row.license_number
      ? String(row.license_number)
      : null,

    gender: row.gender
      ? String(row.gender)
      : null,

    licenseIssueDate:
      formatDatabaseDateOnly(
        row.license_issue_date
      ),

    professionalTitle:
      row.professional_title
        ? String(row.professional_title)
        : null,

    licenseIssuer: row.license_issuer
      ? String(row.license_issuer)
      : null,

    professionalScope:
      row.professional_scope
        ? String(row.professional_scope)
        : null,

    registrationTime:
      row.registration_time
        ? String(row.registration_time)
        : null,

    dailyTime: row.daily_time
      ? String(row.daily_time)
      : null,

    weeklyTime: row.weekly_time
      ? String(row.weekly_time)
      : null,

    position: row.position
      ? String(row.position)
      : null,

    note: row.note
      ? String(row.note)
      : null,

    active: Boolean(row.active),

    departments:
      Array.isArray(row.departments)
        ? row.departments
        : [],

    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createMedicalStaff(
  data: MedicalStaffInput
) {
  const validated =
    validateMedicalStaffInput(data);

  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `
      INSERT INTO catalog.medical_staff (
        full_name,
        social_insurance_code,
        license_number,
        gender,
        license_issue_date,
        professional_title,
        license_issuer,
        professional_scope,
        registration_time,
        daily_time,
        weekly_time,
        position,
        note,
        active,
        created_at,
        updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13, $14,
        NOW(), NOW()
      )
      RETURNING id
      `,
      [
        validated.fullName,
        validated.socialInsuranceCode,
        validated.licenseNumber,
        validated.gender,
        validated.licenseIssueDate,
        validated.professionalTitle,
        validated.licenseIssuer,
        validated.professionalScope,
        validated.registrationTime,
        validated.dailyTime,
        validated.weeklyTime,
        validated.position,
        validated.note,
        validated.active,
      ]
    );

    const staffId =
      String(result.rows[0].id);

    await replaceMedicalStaffDepartments(
      client,
      staffId,
      validated.departmentCodes
    );

    await client.query("COMMIT");

    return await getMedicalStaff(staffId);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateMedicalStaff(
  id: string,
  data: MedicalStaffInput
) {
  const normalizedId = normalizeText(id);

  if (!normalizedId) {
    throw new Error(
      "Thiếu ID nhân viên y tế."
    );
  }

  const validated =
    validateMedicalStaffInput(data);

  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const current = await client.query(
      `
      SELECT id
      FROM catalog.medical_staff
      WHERE id = $1::uuid
      LIMIT 1
      `,
      [normalizedId]
    );

    if (current.rowCount === 0) {
      throw new Error(
        "Không tìm thấy nhân viên y tế."
      );
    }

    await client.query(
      `
      UPDATE catalog.medical_staff
      SET
        full_name = $2,
        social_insurance_code = $3,
        license_number = $4,
        gender = $5,
        license_issue_date = $6,
        professional_title = $7,
        license_issuer = $8,
        professional_scope = $9,
        registration_time = $10,
        daily_time = $11,
        weekly_time = $12,
        position = $13,
        note = $14,
        active = $15,
        updated_at = NOW()
      WHERE id = $1::uuid
      `,
      [
        normalizedId,
        validated.fullName,
        validated.socialInsuranceCode,
        validated.licenseNumber,
        validated.gender,
        validated.licenseIssueDate,
        validated.professionalTitle,
        validated.licenseIssuer,
        validated.professionalScope,
        validated.registrationTime,
        validated.dailyTime,
        validated.weeklyTime,
        validated.position,
        validated.note,
        validated.active,
      ]
    );

    await replaceMedicalStaffDepartments(
      client,
      normalizedId,
      validated.departmentCodes
    );

    await client.query("COMMIT");

    return await getMedicalStaff(
      normalizedId
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteMedicalStaff(
  id: string
) {
  const normalizedId = normalizeText(id);

  if (!normalizedId) {
    throw new Error(
      "Thiếu ID nhân viên y tế."
    );
  }

  const result = await db.query(
    `
    UPDATE catalog.medical_staff
    SET
      active = false,
      updated_at = NOW()
    WHERE id = $1::uuid
    RETURNING id
    `,
    [normalizedId]
  );

  if (result.rowCount === 0) {
    throw new Error(
      "Không tìm thấy nhân viên y tế."
    );
  }

  return true;
}

// ======================================================
// DRUG TYPES
// ======================================================

export interface ListDrugsParams {
  code?: string;
  name?: string;
  activeIngredient?: string;
  groupCode?: string;
  active?: boolean;
  limit: number;
  offset: number;
}

export interface DrugInput {
  code?: string;
  name?: string;
  activeIngredient?: string | null;
  strength?: string | null;
  unit?: string | null;
  groupCode?: string | null;
  route?: string | null;
  routeCode?: string | null;
  dosageForm?: string | null;
  registrationNumber?: string | null;
  quantity?: number | null;
  unitPrice?: number | null;
  insuranceUnitPrice?: number | null;
  packaging?: string | null;
  manufacturer?: string | null;
  country?: string | null;
  contractor?: string | null;
  tenderInfo?: string | null;
  drugType?: string | null;
  scientificName?: string | null;
  origin?: string | null;
  processingMethod?: string | null;
  importedMaterialCode?: string | null;
  processedMaterialCode?: string | null;
  processingLossRate?: number | null;
  preservationLossRate?: number | null;
  qualityStandard?: string | null;
  decisionNo?: string | null;
  insurancePaymentRate?: number | null;
  note?: string | null;
  active?: boolean;
}

// ======================================================
// DRUG HELPERS
// ======================================================

function normalizeDrugOptionalText(
  value: unknown
): string | null {
  const text = normalizeText(value);

  return text || null;
}

function normalizeDrugNullableNumber(
  value: unknown,
  fieldName: string
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    throw new Error(
      `${fieldName} không hợp lệ.`
    );
  }

  if (numberValue < 0) {
    throw new Error(
      `${fieldName} không được nhỏ hơn 0.`
    );
  }

  return numberValue;
}

function validateDrugInput(
  data: DrugInput
) {
  const code = normalizeText(data.code);
  const name = normalizeText(data.name);

  if (!code) {
    throw new Error(
      "Vui lòng nhập mã thuốc."
    );
  }

  if (!name) {
    throw new Error(
      "Vui lòng nhập tên thuốc."
    );
  }

  const quantity =
    normalizeDrugNullableNumber(
      data.quantity,
      "Số lượng"
    );

  const unitPrice =
    Number(data.unitPrice ?? 0);

  if (
    !Number.isFinite(unitPrice) ||
    unitPrice < 0
  ) {
    throw new Error(
      "Đơn giá thuốc không hợp lệ."
    );
  }

  const insuranceUnitPrice =
    normalizeDrugNullableNumber(
      data.insuranceUnitPrice,
      "Đơn giá BH"
    );

  const processingLossRate =
    normalizeDrugNullableNumber(
      data.processingLossRate,
      "Tỷ lệ hao hụt chế biến"
    );

  const preservationLossRate =
    normalizeDrugNullableNumber(
      data.preservationLossRate,
      "Tỷ lệ hao hụt bảo quản"
    );

  const insurancePaymentRate =
    Number(
      data.insurancePaymentRate ?? 100
    );

  if (
    !Number.isFinite(
      insurancePaymentRate
    ) ||
    insurancePaymentRate < 0 ||
    insurancePaymentRate > 100
  ) {
    throw new Error(
      "Tỷ lệ thanh toán BHYT phải từ 0 đến 100."
    );
  }

  return {
    code,
    name,

    activeIngredient:
      normalizeDrugOptionalText(
        data.activeIngredient
      ),

    strength:
      normalizeDrugOptionalText(
        data.strength
      ),

    unit:
      normalizeDrugOptionalText(
        data.unit
      ),

    groupCode:
      normalizeDrugOptionalText(
        data.groupCode
      ),

    route:
      normalizeDrugOptionalText(
        data.route
      ),

    routeCode:
      normalizeDrugOptionalText(
        data.routeCode
      ),

    dosageForm:
      normalizeDrugOptionalText(
        data.dosageForm
      ),

    registrationNumber:
      normalizeDrugOptionalText(
        data.registrationNumber
      ),

    quantity,
    unitPrice,
    insuranceUnitPrice,

    packaging:
      normalizeDrugOptionalText(
        data.packaging
      ),

    manufacturer:
      normalizeDrugOptionalText(
        data.manufacturer
      ),

    country:
      normalizeDrugOptionalText(
        data.country
      ),

    contractor:
      normalizeDrugOptionalText(
        data.contractor
      ),

    tenderInfo:
      normalizeDrugOptionalText(
        data.tenderInfo
      ),

    drugType:
      normalizeDrugOptionalText(
        data.drugType
      ),

    scientificName:
      normalizeDrugOptionalText(
        data.scientificName
      ),

    origin:
      normalizeDrugOptionalText(
        data.origin
      ),

    processingMethod:
      normalizeDrugOptionalText(
        data.processingMethod
      ),

    importedMaterialCode:
      normalizeDrugOptionalText(
        data.importedMaterialCode
      ),

    processedMaterialCode:
      normalizeDrugOptionalText(
        data.processedMaterialCode
      ),

    processingLossRate,
    preservationLossRate,

    qualityStandard:
      normalizeDrugOptionalText(
        data.qualityStandard
      ),

    decisionNo:
      normalizeDrugOptionalText(
        data.decisionNo
      ),

    insurancePaymentRate,

    note:
      normalizeDrugOptionalText(
        data.note
      ),

    active: data.active ?? true,
  };
}

function mapDrugRow(row: any) {
  return {
    id: String(row.id),
    code: String(row.code),
    name: String(row.name),

    activeIngredient:
      row.active_ingredient !== null &&
      row.active_ingredient !== undefined
        ? String(row.active_ingredient)
        : null,

    strength:
      row.strength !== null &&
      row.strength !== undefined
        ? String(row.strength)
        : null,

    unit:
      row.unit !== null &&
      row.unit !== undefined
        ? String(row.unit)
        : null,

    groupCode:
      row.group_code !== null &&
      row.group_code !== undefined
        ? String(row.group_code)
        : null,

    route:
      row.route !== null &&
      row.route !== undefined
        ? String(row.route)
        : null,

    routeCode:
      row.route_code !== null &&
      row.route_code !== undefined
        ? String(row.route_code)
        : null,

    dosageForm:
      row.dosage_form !== null &&
      row.dosage_form !== undefined
        ? String(row.dosage_form)
        : null,

    registrationNumber:
      row.registration_number !== null &&
      row.registration_number !== undefined
        ? String(row.registration_number)
        : null,

    quantity:
      row.quantity !== null &&
      row.quantity !== undefined
        ? Number(row.quantity)
        : null,

    unitPrice: Number(
      row.unit_price ?? 0
    ),

    insuranceUnitPrice:
      row.insurance_unit_price !== null &&
      row.insurance_unit_price !== undefined
        ? Number(row.insurance_unit_price)
        : null,

    packaging:
      row.packaging !== null &&
      row.packaging !== undefined
        ? String(row.packaging)
        : null,

    manufacturer:
      row.manufacturer !== null &&
      row.manufacturer !== undefined
        ? String(row.manufacturer)
        : null,

    country:
      row.country !== null &&
      row.country !== undefined
        ? String(row.country)
        : null,

    contractor:
      row.contractor !== null &&
      row.contractor !== undefined
        ? String(row.contractor)
        : null,

    tenderInfo:
      row.tender_info !== null &&
      row.tender_info !== undefined
        ? String(row.tender_info)
        : null,

    drugType:
      row.drug_type !== null &&
      row.drug_type !== undefined
        ? String(row.drug_type)
        : null,

    scientificName:
      row.scientific_name !== null &&
      row.scientific_name !== undefined
        ? String(row.scientific_name)
        : null,

    origin:
      row.origin !== null &&
      row.origin !== undefined
        ? String(row.origin)
        : null,

    processingMethod:
      row.processing_method !== null &&
      row.processing_method !== undefined
        ? String(row.processing_method)
        : null,

    importedMaterialCode:
      row.imported_material_code !== null &&
      row.imported_material_code !== undefined
        ? String(row.imported_material_code)
        : null,

    processedMaterialCode:
      row.processed_material_code !== null &&
      row.processed_material_code !== undefined
        ? String(row.processed_material_code)
        : null,

    processingLossRate:
      row.processing_loss_rate !== null &&
      row.processing_loss_rate !== undefined
        ? Number(row.processing_loss_rate)
        : null,

    preservationLossRate:
      row.preservation_loss_rate !== null &&
      row.preservation_loss_rate !== undefined
        ? Number(row.preservation_loss_rate)
        : null,

    qualityStandard:
      row.quality_standard !== null &&
      row.quality_standard !== undefined
        ? String(row.quality_standard)
        : null,

    decisionNo:
      row.decision_no !== null &&
      row.decision_no !== undefined
        ? String(row.decision_no)
        : null,

    insurancePaymentRate: Number(
      row.insurance_payment_rate ?? 100
    ),

    note:
      row.note !== null &&
      row.note !== undefined
        ? String(row.note)
        : null,

    active: Boolean(row.active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const DRUG_SELECT_COLUMNS = `
  d.id,
  d.code,
  d.name,
  d.active_ingredient,
  d.strength,
  d.unit,
  d.group_code,
  d.route,
  d.route_code,
  d.dosage_form,
  d.registration_number,
  d.quantity,
  d.unit_price,
  d.insurance_unit_price,
  d.packaging,
  d.manufacturer,
  d.country,
  d.contractor,
  d.tender_info,
  d.drug_type,
  d.scientific_name,
  d.origin,
  d.processing_method,
  d.imported_material_code,
  d.processed_material_code,
  d.processing_loss_rate,
  d.preservation_loss_rate,
  d.quality_standard,
  d.decision_no,
  d.insurance_payment_rate,
  d.note,
  d.active,
  d.created_at,
  d.updated_at
`;

// ======================================================
// DRUG CRUD
// ======================================================

export async function listDrugs(
  params: ListDrugsParams
) {
  const {
    code,
    name,
    activeIngredient,
    groupCode,
    active,
    limit,
    offset,
  } = params;

  const conditions: string[] = [];
  const values: unknown[] = [];

  if (code) {
    values.push(
      `%${normalizeText(code)}%`
    );

    conditions.push(
      `d.code ILIKE $${values.length}`
    );
  }

  if (name) {
    values.push(
      `%${normalizeText(name)}%`
    );

    conditions.push(
      `d.name ILIKE $${values.length}`
    );
  }

  if (activeIngredient) {
    values.push(
      `%${normalizeText(activeIngredient)}%`
    );

    conditions.push(
      `COALESCE(d.active_ingredient, '') ILIKE $${values.length}`
    );
  }

  if (groupCode) {
    values.push(
      normalizeText(groupCode)
    );

    conditions.push(
      `d.group_code = $${values.length}`
    );
  }

  if (active !== undefined) {
    values.push(active);

    conditions.push(
      `d.active = $${values.length}`
    );
  }

  const whereSql = conditions.length > 0
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  const limitIndex = values.length + 1;
  const offsetIndex = values.length + 2;

  const result = await db.query(
    `
    SELECT ${DRUG_SELECT_COLUMNS}
    FROM catalog.drugs d
    ${whereSql}
    ORDER BY d.name ASC, d.code ASC
    LIMIT $${limitIndex}
    OFFSET $${offsetIndex}
    `,
    [...values, limit, offset]
  );

  const countResult = await db.query(
    `
    SELECT COUNT(*)::integer AS total
    FROM catalog.drugs d
    ${whereSql}
    `,
    values
  );

  return {
    items: result.rows.map(
      row => mapDrugRow(row)
    ),

    total: Number(
      countResult.rows[0]?.total ?? 0
    ),
  };
}

export async function getDrug(
  id: string
) {
  const normalizedId = normalizeText(id);

  if (!normalizedId) {
    throw new Error("Thiếu ID thuốc.");
  }

  const result = await db.query(
    `
    SELECT ${DRUG_SELECT_COLUMNS}
    FROM catalog.drugs d
    WHERE d.id = $1::uuid
    LIMIT 1
    `,
    [normalizedId]
  );

  if (result.rowCount === 0) {
    return null;
  }

  return mapDrugRow(
    result.rows[0]
  );
}

export async function createDrug(
  data: DrugInput
) {
  const validated =
    validateDrugInput(data);

  const duplicate = await db.query(
    `
    SELECT id
    FROM catalog.drugs
    WHERE LOWER(BTRIM(code)) = LOWER(BTRIM($1))
      AND LOWER(BTRIM(name)) = LOWER(BTRIM($2))
      AND LOWER(BTRIM(COALESCE(active_ingredient, '')))
        = LOWER(BTRIM(COALESCE($3, '')))
      AND LOWER(BTRIM(COALESCE(registration_number, '')))
        = LOWER(BTRIM(COALESCE($4, '')))
    LIMIT 1
    `,
    [
      validated.code,
      validated.name,
      validated.activeIngredient,
      validated.registrationNumber,
    ]
  );

  if ((duplicate.rowCount ?? 0) > 0) {
    throw new Error(
      "Thuốc trùng mã, tên, hoạt chất và số đăng ký đã tồn tại."
    );
  }

  const insertedResult =
    await db.query<{ id: string }>(
      `
      INSERT INTO catalog.drugs (
        code,
        name,
        active_ingredient,
        strength,
        unit,
        group_code,
        route,
        route_code,
        dosage_form,
        registration_number,
        quantity,
        unit_price,
        insurance_unit_price,
        packaging,
        manufacturer,
        country,
        contractor,
        tender_info,
        drug_type,
        scientific_name,
        origin,
        processing_method,
        imported_material_code,
        processed_material_code,
        processing_loss_rate,
        preservation_loss_rate,
        quality_standard,
        decision_no,
        insurance_payment_rate,
        note,
        active,
        created_at,
        updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20,
        $21, $22, $23, $24, $25,
        $26, $27, $28, $29, $30,
        $31, NOW(), NOW()
      )
      RETURNING id
      `,
      [
        validated.code,
        validated.name,
        validated.activeIngredient,
        validated.strength,
        validated.unit,
        validated.groupCode,
        validated.route,
        validated.routeCode,
        validated.dosageForm,
        validated.registrationNumber,
        validated.quantity,
        validated.unitPrice,
        validated.insuranceUnitPrice,
        validated.packaging,
        validated.manufacturer,
        validated.country,
        validated.contractor,
        validated.tenderInfo,
        validated.drugType,
        validated.scientificName,
        validated.origin,
        validated.processingMethod,
        validated.importedMaterialCode,
        validated.processedMaterialCode,
        validated.processingLossRate,
        validated.preservationLossRate,
        validated.qualityStandard,
        validated.decisionNo,
        validated.insurancePaymentRate,
        validated.note,
        validated.active,
      ]
    );

  return await getDrug(
    insertedResult.rows[0].id
  );
}

export async function updateDrug(
  id: string,
  data: DrugInput
) {
  const normalizedId = normalizeText(id);

  if (!normalizedId) {
    throw new Error(
      "Thiếu ID thuốc cần cập nhật."
    );
  }

  const current = await db.query(
    `
    SELECT code
    FROM catalog.drugs
    WHERE id = $1::uuid
    LIMIT 1
    `,
    [normalizedId]
  );

  if (current.rowCount === 0) {
    throw new Error(
      "Không tìm thấy thuốc."
    );
  }

  const validated = validateDrugInput({
    ...data,
    code: String(
      current.rows[0].code
    ),
  });

  await db.query(
    `
    UPDATE catalog.drugs
    SET
      name = $2,
      active_ingredient = $3,
      strength = $4,
      unit = $5,
      group_code = $6,
      route = $7,
      route_code = $8,
      dosage_form = $9,
      registration_number = $10,
      quantity = $11,
      unit_price = $12,
      insurance_unit_price = $13,
      packaging = $14,
      manufacturer = $15,
      country = $16,
      contractor = $17,
      tender_info = $18,
      drug_type = $19,
      scientific_name = $20,
      origin = $21,
      processing_method = $22,
      imported_material_code = $23,
      processed_material_code = $24,
      processing_loss_rate = $25,
      preservation_loss_rate = $26,
      quality_standard = $27,
      decision_no = $28,
      insurance_payment_rate = $29,
      note = $30,
      active = $31,
      updated_at = NOW()
    WHERE id = $1::uuid
    `,
    [
      normalizedId,
      validated.name,
      validated.activeIngredient,
      validated.strength,
      validated.unit,
      validated.groupCode,
      validated.route,
      validated.routeCode,
      validated.dosageForm,
      validated.registrationNumber,
      validated.quantity,
      validated.unitPrice,
      validated.insuranceUnitPrice,
      validated.packaging,
      validated.manufacturer,
      validated.country,
      validated.contractor,
      validated.tenderInfo,
      validated.drugType,
      validated.scientificName,
      validated.origin,
      validated.processingMethod,
      validated.importedMaterialCode,
      validated.processedMaterialCode,
      validated.processingLossRate,
      validated.preservationLossRate,
      validated.qualityStandard,
      validated.decisionNo,
      validated.insurancePaymentRate,
      validated.note,
      validated.active,
    ]
  );

  return await getDrug(normalizedId);
}

export async function deleteDrug(
  id: string
) {
  const normalizedId = normalizeText(id);

  if (!normalizedId) {
    throw new Error("Thiếu ID thuốc.");
  }

  const result = await db.query(
    `
    UPDATE catalog.drugs
    SET
      active = false,
      updated_at = NOW()
    WHERE id = $1::uuid
    RETURNING id
    `,
    [normalizedId]
  );

  if (result.rowCount === 0) {
    throw new Error(
      "Không tìm thấy thuốc."
    );
  }

  return true;
}