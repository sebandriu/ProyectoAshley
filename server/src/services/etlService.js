const VALID_ORIGINS = new Set(["OF", "FR", "FD"]);

function normalizeKey(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[°º]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

function createAccessor(data) {
  const normalized = new Map();

  Object.entries(data ?? {}).forEach(([key, value]) => {
    normalized.set(normalizeKey(key), value);
  });

  return (...aliases) => {
    for (const alias of aliases) {
      const key = normalizeKey(alias);

      if (normalized.has(key)) {
        return normalized.get(key);
      }
    }

    return null;
  };
}

function toText(value) {
  if (value === null || value === undefined) return null;

  const text = String(value).trim();
  return text === "" ? null : text;
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  let text = String(value)
    .trim()
    .replace(/\s+/g, "")
    .replace(/[$%]/g, "");

  if (!text) return null;

  const hasComma = text.includes(",");
  const hasDot = text.includes(".");

  if (hasComma && hasDot) {
    if (text.lastIndexOf(",") > text.lastIndexOf(".")) {
      text = text.replace(/\./g, "").replace(",", ".");
    } else {
      text = text.replace(/,/g, "");
    }
  } else if (hasComma) {
    text = text.replace(",", ".");
  }

  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function toInteger(value) {
  const number = toNumber(value);
  return number === null ? null : Math.trunc(number);
}

function normalizeDiscountPct(value) {
  const number = toNumber(value);

  if (number === null) {
    return {
      value: null,
      anomalous: false,
    };
  }

  if (number < -100 || number > 100) {
    return {
      value: null,
      anomalous: true,
    };
  }

  return {
    value: number,
    anomalous: false,
  };
}

function toDate(value) {
  if (value === null || value === undefined || value === "") return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const milliseconds = Math.round((value - 25569) * 86400 * 1000);
    const date = new Date(milliseconds);

    if (!Number.isNaN(date.getTime())) {
      return date.toISOString().slice(0, 10);
    }
  }

  const text = String(value).trim();

  const ddmmyyyy = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);

  if (ddmmyyyy) {
    const [, day, month, year] = ddmmyyyy;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const yyyymmdd = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);

  if (yyyymmdd) {
    const [, year, month, day] = yyyymmdd;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const parsed = new Date(text);

  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return null;
}

function normalizeCancellation(value) {
  const text = toText(value)?.toUpperCase() ?? null;

  if (["N", "Y", "C"].includes(text)) {
    return text;
  }

  return text ? text.slice(0, 1) : null;
}

function classifyLine(itemCode) {
  const code = toText(itemCode)?.toUpperCase() ?? "";

  return code.startsWith("700-") ? "SERVICIO" : "PRODUCTO";
}

function sumNullable(values) {
  const present = values.filter((value) => value !== null);

  if (present.length === 0) {
    return null;
  }

  return present.reduce((total, value) => total + value, 0);
}

function calculateOfferState(document) {
  if (document.tipoDocumento !== "OF") return null;

  if (["Y", "C"].includes(document.canceladaSap)) {
    return "CANCELADA";
  }

  const productLines = document.lines.filter(
    (line) => line.tipoLinea === "PRODUCTO"
  );

  const convertedLines = productLines.filter(
    (line) =>
      line.targetType === 13 &&
      line.targetEntry !== null &&
      line.targetEntry > 0
  );

  if (convertedLines.length === 0) {
    return document.estadoSap === "C"
      ? "CERRADA SIN VENTA"
      : "PENDIENTE";
  }

  const allLinesConverted =
    convertedLines.length === productLines.length &&
    productLines.every((line) => (line.cantidadAbierta ?? 0) <= 0);

  return allLinesConverted
    ? "CONVERTIDA COMPLETA"
    : "CONVERSION PARCIAL";
}

function parseLine(accessor, rowNumber) {
  const rawLineaSap = accessor(
    "N° Linea",
    "N Linea",
    "Numero Linea",
    "LineNum"
  );

  const lineaSap =
    rawLineaSap === null ||
    rawLineaSap === undefined ||
    String(rawLineaSap).trim() === ""
      ? 0
      : toInteger(rawLineaSap);

  if (lineaSap === null) {
    throw new Error(`La fila ${rowNumber} no contiene un número de línea válido.`);
  }

  const codigoItem = toText(
    accessor("Código", "Codigo", "ItemCode")
  );

  const tipoVentaDestino =
    toText(accessor("Tipo Venta Destino"))?.toUpperCase() ?? null;

  const discount = normalizeDiscountPct(
    accessor("% Descuento", "Descuento", "DiscPrcnt")
  );

  let targetType = toInteger(
    accessor("TargetType", "Clase de documento de destino")
  );

  const targetEntry = toInteger(
    accessor(
      "TargetEntry",
      "Clave interna de documento de destino",
      "DocEntry Destino"
    )
  );

  if (
    targetType === null &&
    targetEntry !== null &&
    ["FR", "FD"].includes(tipoVentaDestino)
  ) {
    targetType = 13;
  }

  return {
    lineaSap,
    codigoItem,
    descripcion: toText(
      accessor("Descripción", "Descripcion", "Dscription")
    ),
    cantidad: toNumber(accessor("Cantidad", "Quantity")),
    cantidadAbierta: toNumber(
      accessor("Cantidad Pendiente", "OpenQty")
    ),
    almacen: toText(accessor("Almacén", "Almacen", "WhsCode")),
    precioUnitario: toNumber(accessor("Precio Unitario")),
    precioSinIva: toNumber(accessor("Precio sin IVA")),
    descuentoPct: discount.value,
    descuentoAnomalo: discount.anomalous,
    totalNeto: toNumber(accessor("Total Neto", "LineTotal")),
    totalBruto: toNumber(accessor("Total Bruto", "GTotal")),
    costoUnitario: toNumber(accessor("Costo Unitario", "StockPrice")),
    costoTotal: toNumber(accessor("Costo Total")),
    contribucion: toNumber(accessor("Contribución", "Contribucion")),
    margen: toNumber(accessor("Margen")),
    tipoLinea: classifyLine(codigoItem),

    targetType,
    targetEntry,

    baseType: toInteger(
      accessor("BaseType", "Clase de documento base")
    ),
    baseEntry: toInteger(
      accessor("BaseEntry", "Clave interna de documento base")
    ),
    baseLine: toInteger(
      accessor(
        "BaseLine",
        "Línea base",
        "Linea base",
        "Número de línea base",
        "Numero de linea base"
      )
    ),

    tipoVentaDestino,
    numeroVentaDestino: toInteger(
      accessor("N° Venta Destino", "N Venta Destino", "Numero Venta Destino")
    ),
    folioVentaDestino: toInteger(accessor("Folio Venta Destino")),
  };
}

function groupDocuments(rows) {
  const documents = new Map();

  for (const row of rows) {
    const accessor = createAccessor(row.data);

    const tipoDocumento =
      toText(accessor("OrigenMicapp"))?.toUpperCase() ?? null;

    if (!VALID_ORIGINS.has(tipoDocumento)) {
      throw new Error(
        `La fila ${row.rowNumber} contiene un OrigenMicapp inválido.`
      );
    }

    const docentrySap = toInteger(
      accessor("Número interno", "Numero interno", "DocEntry")
    );

    const fecha = toDate(accessor("Fecha"));

    if (docentrySap === null) {
      throw new Error(
        `La fila ${row.rowNumber} no contiene un DocEntry válido.`
      );
    }

    if (!fecha) {
      throw new Error(
        `La fila ${row.rowNumber} no contiene una fecha válida.`
      );
    }

    const key = `${tipoDocumento}:${docentrySap}`;

    if (!documents.has(key)) {
      documents.set(key, {
        key,
        tipoDocumento,
        docentrySap,
        numeroDocumento: toInteger(
          accessor("N° Documento", "N Documento", "Numero Documento", "DocNum")
        ),
        folio: toInteger(accessor("Folio")),
        fecha,
        estadoSap: toText(accessor("Estado SAP", "DocStatus"))?.toUpperCase() ?? null,
        canceladaSap: normalizeCancellation(
          accessor("Cancelada", "CANCELED", "Canceled")
        ),
        tienda: toText(accessor("Tienda")),
        vendedor: toText(accessor("Vendedor")),
        lines: [],
      });
    }

    const document = documents.get(key);
    document.lines.push(parseLine(accessor, row.rowNumber));
  }

  for (const document of documents.values()) {
    document.totalNeto = sumNullable(
      document.lines.map((line) => line.totalNeto)
    );
    document.totalBruto = sumNullable(
      document.lines.map((line) => line.totalBruto)
    );
    document.contribucion = sumNullable(
      document.lines.map((line) => line.contribucion)
    );

    document.margen =
      document.totalNeto !== null &&
      document.contribucion !== null &&
      Math.abs(document.totalNeto) > 0.000001
        ? (document.contribucion / document.totalNeto) * 100
        : null;

    document.estadoAnalitico = calculateOfferState(document);
  }

  return documents;
}

async function loadRawRows(client, importacionId) {
  const result = await client.query(
    `SELECT numero_fila, datos
     FROM importacion_raw
     WHERE importacion_id = $1
     ORDER BY numero_fila`,
    [importacionId]
  );

  return result.rows.map((row) => ({
    rowNumber: row.numero_fila,
    data: row.datos,
  }));
}

const DOCUMENT_BATCH_SIZE = 1000;
const LINE_BATCH_SIZE = 1000;
const RELATION_BATCH_SIZE = 1000;
const DESTINATION_LOOKUP_BATCH_SIZE = 5000;
const DOCUMENT_RESET_BATCH_SIZE = 5000;

async function upsertDocumentsBatch(
  client,
  importacionId,
  documents
) {
  if (documents.length === 0) return [];

  const payload = documents.map((document) => ({
    tipo_documento: document.tipoDocumento,
    docentry_sap: document.docentrySap,
    numero_documento: document.numeroDocumento,
    folio: document.folio,
    fecha: document.fecha,
    estado_sap: document.estadoSap,
    cancelada_sap: document.canceladaSap,
    estado_analitico: document.estadoAnalitico,
    tienda: document.tienda,
    vendedor: document.vendedor,
    total_neto: document.totalNeto,
    total_bruto: document.totalBruto,
    contribucion: document.contribucion,
    margen: document.margen,
  }));

  const result = await client.query(
    `INSERT INTO documentos (
        importacion_id,
        tipo_documento,
        docentry_sap,
        numero_documento,
        folio,
        fecha,
        estado_sap,
        cancelada_sap,
        estado_analitico,
        tienda,
        vendedor,
        total_neto,
        total_bruto,
        contribucion,
        margen
     )
     SELECT
        $1,
        x.tipo_documento,
        x.docentry_sap,
        x.numero_documento,
        x.folio,
        x.fecha,
        x.estado_sap,
        x.cancelada_sap,
        x.estado_analitico,
        x.tienda,
        x.vendedor,
        x.total_neto,
        x.total_bruto,
        x.contribucion,
        x.margen
     FROM jsonb_to_recordset($2::jsonb) AS x(
        tipo_documento TEXT,
        docentry_sap BIGINT,
        numero_documento BIGINT,
        folio BIGINT,
        fecha DATE,
        estado_sap TEXT,
        cancelada_sap TEXT,
        estado_analitico TEXT,
        tienda TEXT,
        vendedor TEXT,
        total_neto NUMERIC,
        total_bruto NUMERIC,
        contribucion NUMERIC,
        margen NUMERIC
     )
     ON CONFLICT (tipo_documento, docentry_sap)
     DO UPDATE SET
        importacion_id = EXCLUDED.importacion_id,
        numero_documento = EXCLUDED.numero_documento,
        folio = EXCLUDED.folio,
        fecha = EXCLUDED.fecha,
        estado_sap = EXCLUDED.estado_sap,
        cancelada_sap = EXCLUDED.cancelada_sap,
        estado_analitico = EXCLUDED.estado_analitico,
        tienda = EXCLUDED.tienda,
        vendedor = EXCLUDED.vendedor,
        total_neto = EXCLUDED.total_neto,
        total_bruto = EXCLUDED.total_bruto,
        contribucion = EXCLUDED.contribucion,
        margen = EXCLUDED.margen,
        actualizado_en = NOW()
     RETURNING id, tipo_documento, docentry_sap`,
    [importacionId, JSON.stringify(payload)]
  );

  return result.rows;
}

async function resetImportedDocumentChildren(client, documentIds) {
  const uniqueIds = [...new Set(documentIds)].filter(Boolean);

  for (
    let offset = 0;
    offset < uniqueIds.length;
    offset += DOCUMENT_RESET_BATCH_SIZE
  ) {
    const batch = uniqueIds.slice(
      offset,
      offset + DOCUMENT_RESET_BATCH_SIZE
    );

    await client.query(
      `DELETE FROM relaciones_documento
       WHERE documento_origen_id = ANY($1::bigint[])`,
      [batch]
    );

    await client.query(
      `DELETE FROM detalle_documento
       WHERE documento_id = ANY($1::bigint[])`,
      [batch]
    );
  }
}

async function upsertLinesBatch(client, lines) {
  if (lines.length === 0) return;

  const resultPayload = lines.map(({ documentId, line }) => ({
    documento_id: documentId,
    linea_sap: line.lineaSap,
    codigo_item: line.codigoItem,
    descripcion: line.descripcion,
    cantidad: line.cantidad,
    cantidad_abierta: line.cantidadAbierta,
    precio_unitario: line.precioUnitario,
    precio_sin_iva: line.precioSinIva,
    descuento_pct: line.descuentoPct,
    total_linea: line.totalBruto,
    total_neto: line.totalNeto,
    total_bruto: line.totalBruto,
    costo_unitario: line.costoUnitario,
    costo_total: line.costoTotal,
    contribucion: line.contribucion,
    margen: line.margen,
    tipo_linea: line.tipoLinea,
    target_type: line.targetType,
    target_entry: line.targetEntry,
    base_type: line.baseType,
    base_entry: line.baseEntry,
    base_line: line.baseLine,
  }));

  await client.query(
    `INSERT INTO detalle_documento (
        documento_id,
        linea_sap,
        codigo_item,
        descripcion,
        cantidad,
        cantidad_abierta,
        precio_unitario,
        precio_sin_iva,
        descuento_pct,
        total_linea,
        total_neto,
        total_bruto,
        costo_unitario,
        costo_total,
        contribucion,
        margen,
        tipo_linea,
        target_type,
        target_entry,
        base_type,
        base_entry,
        base_line
     )
     SELECT
        x.documento_id,
        x.linea_sap,
        x.codigo_item,
        x.descripcion,
        x.cantidad,
        x.cantidad_abierta,
        x.precio_unitario,
        x.precio_sin_iva,
        x.descuento_pct,
        x.total_linea,
        x.total_neto,
        x.total_bruto,
        x.costo_unitario,
        x.costo_total,
        x.contribucion,
        x.margen,
        x.tipo_linea,
        x.target_type,
        x.target_entry,
        x.base_type,
        x.base_entry,
        x.base_line
     FROM jsonb_to_recordset($1::jsonb) AS x(
        documento_id BIGINT,
        linea_sap INTEGER,
        codigo_item TEXT,
        descripcion TEXT,
        cantidad NUMERIC,
        cantidad_abierta NUMERIC,
        precio_unitario NUMERIC,
        precio_sin_iva NUMERIC,
        descuento_pct NUMERIC,
        total_linea NUMERIC,
        total_neto NUMERIC,
        total_bruto NUMERIC,
        costo_unitario NUMERIC,
        costo_total NUMERIC,
        contribucion NUMERIC,
        margen NUMERIC,
        tipo_linea TEXT,
        target_type INTEGER,
        target_entry BIGINT,
        base_type INTEGER,
        base_entry BIGINT,
        base_line INTEGER
     )
     ON CONFLICT (documento_id, linea_sap)
     DO UPDATE SET
        codigo_item = EXCLUDED.codigo_item,
        descripcion = EXCLUDED.descripcion,
        cantidad = EXCLUDED.cantidad,
        cantidad_abierta = EXCLUDED.cantidad_abierta,
        precio_unitario = EXCLUDED.precio_unitario,
        precio_sin_iva = EXCLUDED.precio_sin_iva,
        descuento_pct = EXCLUDED.descuento_pct,
        total_linea = EXCLUDED.total_linea,
        total_neto = EXCLUDED.total_neto,
        total_bruto = EXCLUDED.total_bruto,
        costo_unitario = EXCLUDED.costo_unitario,
        costo_total = EXCLUDED.costo_total,
        contribucion = EXCLUDED.contribucion,
        margen = EXCLUDED.margen,
        tipo_linea = EXCLUDED.tipo_linea,
        target_type = EXCLUDED.target_type,
        target_entry = EXCLUDED.target_entry,
        base_type = EXCLUDED.base_type,
        base_entry = EXCLUDED.base_entry,
        base_line = EXCLUDED.base_line`,
    [JSON.stringify(resultPayload)]
  );
}

async function loadDestinationDocuments(client, targetEntries) {
  const destinations = new Map();

  for (
    let offset = 0;
    offset < targetEntries.length;
    offset += DESTINATION_LOOKUP_BATCH_SIZE
  ) {
    const batch = targetEntries.slice(
      offset,
      offset + DESTINATION_LOOKUP_BATCH_SIZE
    );

    const result = await client.query(
      `SELECT
          id,
          tipo_documento,
          docentry_sap,
          numero_documento,
          folio
       FROM documentos
       WHERE tipo_documento IN ('FR', 'FD')
         AND docentry_sap = ANY($1::bigint[])`,
      [batch]
    );

    for (const row of result.rows) {
      destinations.set(String(row.docentry_sap), row);
    }
  }

  return destinations;
}

async function upsertRelationsBatch(client, relations) {
  if (relations.length === 0) return;

  const payload = relations.map(
    ({ documentId, line, destination }) => ({
      documento_origen_id: documentId,
      linea_origen: line.lineaSap,
      target_type: line.targetType,
      target_docentry_sap: line.targetEntry,
      documento_destino_id: destination?.id ?? null,
      tipo_venta:
        line.tipoVentaDestino ??
        destination?.tipo_documento ??
        null,
      numero_documento_destino:
        line.numeroVentaDestino ??
        destination?.numero_documento ??
        null,
      folio_destino:
        line.folioVentaDestino ??
        destination?.folio ??
        null,
    })
  );

  await client.query(
    `INSERT INTO relaciones_documento (
        documento_origen_id,
        linea_origen,
        target_type,
        target_docentry_sap,
        documento_destino_id,
        tipo_venta,
        numero_documento_destino,
        folio_destino
     )
     SELECT
        x.documento_origen_id,
        x.linea_origen,
        x.target_type,
        x.target_docentry_sap,
        x.documento_destino_id,
        x.tipo_venta,
        x.numero_documento_destino,
        x.folio_destino
     FROM jsonb_to_recordset($1::jsonb) AS x(
        documento_origen_id BIGINT,
        linea_origen INTEGER,
        target_type INTEGER,
        target_docentry_sap BIGINT,
        documento_destino_id BIGINT,
        tipo_venta TEXT,
        numero_documento_destino BIGINT,
        folio_destino BIGINT
     )
     ON CONFLICT (
        documento_origen_id,
        linea_origen,
        target_type,
        target_docentry_sap
     )
     DO UPDATE SET
        documento_destino_id = EXCLUDED.documento_destino_id,
        tipo_venta = EXCLUDED.tipo_venta,
        numero_documento_destino = EXCLUDED.numero_documento_destino,
        folio_destino = EXCLUDED.folio_destino`,
    [JSON.stringify(payload)]
  );
}

async function relinkExistingRelations(client) {
  await client.query(
    `UPDATE relaciones_documento AS r
     SET
       documento_destino_id = d.id,
       tipo_venta = COALESCE(r.tipo_venta, d.tipo_documento),
       numero_documento_destino =
         COALESCE(r.numero_documento_destino, d.numero_documento),
       folio_destino = COALESCE(r.folio_destino, d.folio)
     FROM documentos AS d
     WHERE d.tipo_documento IN ('FR', 'FD')
       AND d.docentry_sap = r.target_docentry_sap
       AND r.documento_destino_id IS DISTINCT FROM d.id`
  );
}

export async function processConsolidatedImport(
  client,
  importacionId,
  providedRows = null
) {
  const rows =
    providedRows ?? (await loadRawRows(client, importacionId));

  if (rows.length === 0) {
    throw new Error("La importación no contiene filas RAW para procesar.");
  }

  const documents = groupDocuments(rows);
  const documentList = [...documents.values()];
  const documentIds = new Map();

  const summary = {
    documentos: {
      OF: 0,
      FR: 0,
      FD: 0,
    },
    estadosOF: {},
    lineas: 0,
    productos: 0,
    servicios: 0,
    relaciones: 0,
    descuentosAnomalos: 0,
  };

  for (const document of documentList) {
    summary.documentos[document.tipoDocumento] += 1;

    if (document.estadoAnalitico) {
      summary.estadosOF[document.estadoAnalitico] =
        (summary.estadosOF[document.estadoAnalitico] ?? 0) + 1;
    }
  }

  for (
    let offset = 0;
    offset < documentList.length;
    offset += DOCUMENT_BATCH_SIZE
  ) {
    const batch = documentList.slice(
      offset,
      offset + DOCUMENT_BATCH_SIZE
    );

    const upserted = await upsertDocumentsBatch(
      client,
      importacionId,
      batch
    );

    for (const row of upserted) {
      documentIds.set(
        `${row.tipo_documento}:${row.docentry_sap}`,
        row.id
      );
    }

    const processed = Math.min(
      offset + batch.length,
      documentList.length
    );

    if (
      processed === documentList.length ||
      processed % 10000 === 0
    ) {
      console.log(
        `[Importación ${importacionId}] Documentos ETL: ${processed}/${documentList.length}`
      );
    }
  }

  await resetImportedDocumentChildren(
    client,
    [...documentIds.values()]
  );

  console.log(
    `[Importación ${importacionId}] Detalle anterior sincronizado para ${documentIds.size} documentos`
  );

  let lineBatch = [];

  for (const document of documentList) {
    const documentId = documentIds.get(document.key);

    if (!documentId) {
      throw new Error(
        `No fue posible resolver el documento ${document.key} durante el ETL.`
      );
    }

    for (const line of document.lines) {
      lineBatch.push({
        documentId,
        line,
      });

      summary.lineas += 1;

      if (line.tipoLinea === "SERVICIO") {
        summary.servicios += 1;
      } else {
        summary.productos += 1;
      }

      if (line.descuentoAnomalo) {
        summary.descuentosAnomalos += 1;
      }

      if (lineBatch.length >= LINE_BATCH_SIZE) {
        await upsertLinesBatch(client, lineBatch);
        lineBatch = [];
      }
    }
  }

  if (lineBatch.length > 0) {
    await upsertLinesBatch(client, lineBatch);
  }

  console.log(
    `[Importación ${importacionId}] Líneas ETL: ${summary.lineas}`
  );

  if (summary.descuentosAnomalos > 0) {
    console.warn(
      `[Importación ${importacionId}] Descuentos anómalos excluidos del análisis: ${summary.descuentosAnomalos}`
    );
  }

  const targetEntrySet = new Set();

  for (const document of documentList) {
    if (document.tipoDocumento !== "OF") continue;

    for (const line of document.lines) {
      if (
        line.targetType === 13 &&
        line.targetEntry !== null &&
        line.targetEntry > 0
      ) {
        targetEntrySet.add(line.targetEntry);
      }
    }
  }

  const destinations = await loadDestinationDocuments(
    client,
    [...targetEntrySet]
  );

  let relationBatch = [];

  for (const document of documentList) {
    if (document.tipoDocumento !== "OF") continue;

    const documentId = documentIds.get(document.key);

    for (const line of document.lines) {
      if (
        line.targetType !== 13 ||
        line.targetEntry === null ||
        line.targetEntry <= 0
      ) {
        continue;
      }

      relationBatch.push({
        documentId,
        line,
        destination: destinations.get(String(line.targetEntry)),
      });

      summary.relaciones += 1;

      if (relationBatch.length >= RELATION_BATCH_SIZE) {
        await upsertRelationsBatch(client, relationBatch);
        relationBatch = [];
      }
    }
  }

  if (relationBatch.length > 0) {
    await upsertRelationsBatch(client, relationBatch);
  }

  await relinkExistingRelations(client);

  console.log(
    `[Importación ${importacionId}] Relaciones ETL: ${summary.relaciones}`
  );

  return summary;
}
