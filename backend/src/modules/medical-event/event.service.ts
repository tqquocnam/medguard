import type {
  PoolClient,
} from "pg";

import {
  db,
} from "../../config/database.js";

import {
  normalizeXmlFile,
} from "./event.normalizer.js";


interface XmlRow {
  medical_case_id: string;
  xml_type: string;
  parsed_data: any;
}


interface EventInsertRow {
  medicalCaseId: string;

  maLk: string | null;

  sourceType: string;
  eventType: string;

  itemCode: string | null;
  itemName: string | null;

  doctorCode: string | null;
  performerCode: string | null;

  departmentCode: string | null;

  startTime: string | null;
  endTime: string | null;

  rawData: any;
}


// ======================================================
// BULK INSERT EVENTS
//
// 500 event / query
// ======================================================

async function insertEventChunk(
  client: PoolClient,
  rows: EventInsertRow[]
) {
  if (rows.length === 0) {
    return;
  }


  const values: unknown[] =
    [];


  const placeholders =
    rows.map(
      (
        row,
        index
      ) => {
        const base =
          index * 12;


        values.push(
          row.medicalCaseId,

          row.maLk,

          row.sourceType,
          row.eventType,

          row.itemCode,
          row.itemName,

          row.doctorCode,
          row.performerCode,

          row.departmentCode,

          row.startTime,
          row.endTime,

          JSON.stringify(
            row.rawData ?? {}
          )
        );


        return `
        (
          $${base + 1},
          $${base + 2},
          $${base + 3},
          $${base + 4},
          $${base + 5},
          $${base + 6},
          $${base + 7},
          $${base + 8},
          $${base + 9},
          $${base + 10},
          $${base + 11},
          $${base + 12}::jsonb
        )
        `;
      }
    )
    .join(",");


  await client.query(
    `
    INSERT INTO core.medical_events
    (
      medical_case_id,

      ma_lk,

      source_type,
      event_type,

      item_code,
      item_name,

      doctor_code,
      performer_code,

      department_code,

      start_time,
      end_time,

      raw_data
    )

    VALUES
      ${placeholders}
    `,
    values
  );
}


// ======================================================
// REBUILD TOÀN BỘ MEDICAL EVENTS
// ======================================================

export async function rebuildMedicalEvents() {
  const client =
    await db.connect();


  try {
    await client.query(
      "BEGIN"
    );


    // ==================================================
    // 1. XÓA EVENT CŨ
    // ==================================================

    await client.query(
      `
      DELETE FROM
        core.medical_events
      `
    );


    // ==================================================
    // 2. LẤY XML2 + XML3
    // ==================================================

    const xmlResult =
      await client.query<XmlRow>(
        `
        SELECT
          medical_case_id,

          xml_type,

          parsed_data

        FROM
          core.medical_xml_files

        WHERE
          xml_type IN (
            'XML2',
            'XML3'
          )

        ORDER BY
          medical_case_id,
          xml_type
        `
      );


    // ==================================================
    // 3. NORMALIZE
    // ==================================================

    const buffer:
      EventInsertRow[] = [];


    let eventCount =
      0;


    let xmlCount =
      0;


    const CHUNK_SIZE =
      500;


    for (
      const xmlFile
      of xmlResult.rows
    ) {
      xmlCount++;


      const events =
        normalizeXmlFile(
          xmlFile.xml_type,
          xmlFile.parsed_data
        );


      for (
        const event
        of events
      ) {
        buffer.push({
          medicalCaseId:
            xmlFile.medical_case_id,

          maLk:
            event.maLk ??
            null,

          sourceType:
            event.sourceType,

          eventType:
            event.eventType,

          itemCode:
            event.itemCode ??
            null,

          itemName:
            event.itemName ??
            null,

          doctorCode:
            event.doctorCode ??
            null,

          performerCode:
            event.performerCode ??
            null,

          departmentCode:
            event.departmentCode ??
            null,

          startTime:
            event.startTime ??
            null,

          endTime:
            event.endTime ??
            null,

          rawData:
            event.rawData ??
            {},
        });


        // ================================================
        // Đủ 500 event -> INSERT 1 lần
        // ================================================

        if (
          buffer.length >=
          CHUNK_SIZE
        ) {
          await insertEventChunk(
            client,
            buffer
          );


          eventCount +=
            buffer.length;


          buffer.length =
            0;
        }
      }
    }


    // ==================================================
    // INSERT PHẦN CÒN LẠI
    // ==================================================

    if (
      buffer.length > 0
    ) {
      await insertEventChunk(
        client,
        buffer
      );


      eventCount +=
        buffer.length;


      buffer.length =
        0;
    }


    // ==================================================
    // COMMIT
    // ==================================================

    await client.query(
      "COMMIT"
    );


    return {
      success: true,

      xmlCount,

      eventCount,
    };

  } catch (error) {

    await client.query(
      "ROLLBACK"
    );


    throw error;

  } finally {

    client.release();

  }
}