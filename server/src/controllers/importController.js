import { pool } from "../config/database.js";
import { readSapWorkbook } from "../services/excelService.js";
import { processConsolidatedImport } from "../services/etlService.js";

const RAW_BATCH_SIZE = 1000;

async function insertRawRowsInBatches(client, importacionId, rows) {
  for (let offset = 0; offset < rows.length; offset += RAW_BATCH_SIZE) {
    const batch = rows.slice(offset, offset + RAW_BATCH_SIZE);

    const payload = batch.map((row) => ({
      numero_fila: row.rowNumber,
      datos: row.data,
    }));

    await client.query(
      `INSERT INTO importacion_raw
        (importacion_id, numero_fila, datos)
       SELECT
         $1,
         x.numero_fila,
         x.datos
       FROM jsonb_to_recordset($2::jsonb)
         AS x(numero_fila INTEGER, datos JSONB)
       ON CONFLICT (importacion_id, numero_fila)
       DO UPDATE SET
         datos = EXCLUDED.datos,
         errores = NULL`,
      [importacionId, JSON.stringify(payload)]
    );

    const processed = Math.min(offset + batch.length, rows.length);

    if (processed === rows.length || processed % 10000 === 0) {
      console.log(
        `[Importación ${importacionId}] RAW guardado: ${processed}/${rows.length} filas`
      );
    }
  }
}

export async function importExcel(req, res) {
  if (!req.file) {
    return res.status(400).json({
      message: "Debes seleccionar un archivo .xlsx.",
    });
  }

  let parsed;

  try {
    parsed = await readSapWorkbook(req.file.buffer);
  } catch (error) {
    console.error("Error al leer Excel:", error);

    return res.status(400).json({
      message: error.message || "No fue posible leer el archivo.",
    });
  }

  let rawClient;
  let importacion;

  try {
    rawClient = await pool.connect();
    await rawClient.query("BEGIN");

    const importResult = await rawClient.query(
      `INSERT INTO importaciones
        (
          nombre_archivo,
          tipo_informe,
          filas_totales,
          filas_validas,
          filas_rechazadas,
          estado
        )
       VALUES ($1, $2, $3, $3, 0, 'PROCESANDO')
       RETURNING id, fecha_importacion`,
      [
        req.file.originalname,
        parsed.tipoInforme,
        parsed.rows.length,
      ]
    );

    importacion = importResult.rows[0];

    await insertRawRowsInBatches(
      rawClient,
      importacion.id,
      parsed.rows
    );

    await rawClient.query("COMMIT");
  } catch (error) {
    if (rawClient) {
      await rawClient.query("ROLLBACK");
    }

    console.error("Error al guardar RAW:", error);

    return res.status(500).json({
      message:
        error.message ||
        "No fue posible guardar los datos RAW de la importación.",
    });
  } finally {
    rawClient?.release();
  }

  if (parsed.tipoInforme !== "CONSOLIDADO") {
    try {
      await pool.query(
        `UPDATE importaciones
         SET estado = 'COMPLETADA',
             observacion = NULL
         WHERE id = $1`,
        [importacion.id]
      );

      return res.status(201).json({
        importacionId: importacion.id,
        archivo: req.file.originalname,
        hoja: parsed.worksheetName,
        tipoInforme: parsed.tipoInforme,
        filasProcesadas: parsed.rows.length,
        estado: "COMPLETADA",
        fechaImportacion: importacion.fecha_importacion,
        origenes: parsed.originCounts,
        columnasIgnoradas: parsed.ignoredColumns,
      });
    } catch (error) {
      console.error("Error al cerrar importación:", error);

      return res.status(500).json({
        message:
          error.message ||
          "Los datos RAW fueron guardados, pero no fue posible cerrar la importación.",
        importacionId: importacion.id,
        rawPreservado: true,
      });
    }
  }

  let etlClient;

  try {
    etlClient = await pool.connect();
    await etlClient.query("BEGIN");

    const etl = await processConsolidatedImport(
      etlClient,
      importacion.id,
      parsed.rows
    );

    await etlClient.query(
      `UPDATE importaciones
       SET estado = 'COMPLETADA',
           observacion = NULL
       WHERE id = $1`,
      [importacion.id]
    );

    await etlClient.query("COMMIT");

    return res.status(201).json({
      importacionId: importacion.id,
      archivo: req.file.originalname,
      hoja: parsed.worksheetName,
      tipoInforme: parsed.tipoInforme,
      filasProcesadas: parsed.rows.length,
      estado: "COMPLETADA",
      fechaImportacion: importacion.fecha_importacion,
      origenes: parsed.originCounts,
      columnasIgnoradas: parsed.ignoredColumns,
      etl,
    });
  } catch (error) {
    if (etlClient) {
      await etlClient.query("ROLLBACK");
    }

    console.error("Error durante ETL:", error);

    try {
      await pool.query(
        `UPDATE importaciones
         SET estado = 'ERROR',
             observacion = $2
         WHERE id = $1`,
        [
          importacion.id,
          `ETL: ${error.message || "Error no identificado"}`,
        ]
      );
    } catch (statusError) {
      console.error(
        "No fue posible registrar el estado ERROR:",
        statusError
      );
    }

    return res.status(422).json({
      message:
        "El archivo fue guardado en RAW, pero el ETL no pudo completarse.",
      detalle:
        error.message || "Error no identificado durante el ETL.",
      importacionId: importacion.id,
      rawPreservado: true,
    });
  } finally {
    etlClient?.release();
  }
}
