import { pool } from "../config/database.js";
import { readSapWorkbook } from "../services/excelService.js";

export async function importExcel(req, res) {
  if (!req.file) {
    return res.status(400).json({
      message: "Debes seleccionar un archivo .xlsx.",
    });
  }

  let client;

  try {
    const parsed = await readSapWorkbook(req.file.buffer);

    client = await pool.connect();
    await client.query("BEGIN");

    const importResult = await client.query(
      `INSERT INTO importaciones
        (nombre_archivo, tipo_informe, filas_totales, filas_validas, filas_rechazadas, estado)
       VALUES ($1, $2, $3, $3, 0, 'PROCESANDO')
       RETURNING id, fecha_importacion`,
      [req.file.originalname, parsed.tipoInforme, parsed.rows.length]
    );

    const importacion = importResult.rows[0];

    for (const row of parsed.rows) {
      await client.query(
        `INSERT INTO importacion_raw
          (importacion_id, numero_fila, datos)
         VALUES ($1, $2, $3::jsonb)`,
        [importacion.id, row.rowNumber, JSON.stringify(row.data)]
      );
    }

    await client.query(
      `UPDATE importaciones
       SET estado = 'COMPLETADA'
       WHERE id = $1`,
      [importacion.id]
    );

    await client.query("COMMIT");

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
    if (client) {
      await client.query("ROLLBACK");
    }

    console.error("Error al importar Excel:", error);

    return res.status(400).json({
      message: error.message || "No fue posible importar el archivo.",
    });
  } finally {
    client?.release();
  }
}
