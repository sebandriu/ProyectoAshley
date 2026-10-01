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
  const lineaSap = toInteger(
    accessor("N° Linea", "N Linea", "Numero Linea", "LineNum")
  );

  if (lineaSap === null) {
    throw new Error(`La fila ${rowNumber} no contiene un número de línea válido.`);
  }

  const codigoItem = toText(
    accessor("Código", "Codigo", "ItemCode")
  );

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
    descuentoPct: toNumber(
      accessor("% Descuento", "Descuento", "DiscPrcnt")
    ),
    totalNeto: toNumber(accessor("Total Neto", "LineTotal")),
    totalBruto: toNumber(accessor("Total Bruto", "GTotal")),
    costoUnitario: toNumber(accessor("Costo Unitario", "StockPrice")),
    costoTotal: toNumber(accessor("Costo Total")),
    contribucion: toNumber(accessor("Contribución", "Contribucion")),
    margen: toNumber(accessor("Margen")),
    tipoLinea: classifyLine(codigoItem),

    targetType: toInteger(
      accessor("TargetType", "Clase de documento de destino")
    ),
    targetEntry: toInteger(
      accessor(
        "TargetEntry",
        "Clave interna de documento de destino",
        "DocEntry Destino"
      )
    ),

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

    tipoVentaDestino: toText(accessor("Tipo Venta Destino"))?.toUpperCase() ?? null,
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

async function upsertDocument(client, importacionId, document) {
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
     VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15
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
     RETURNING id`,
    [
      importacionId,
      document.tipoDocumento,
      document.docentrySap,
      document.numeroDocumento,
      document.folio,
      document.fecha,
      document.estadoSap,
      document.canceladaSap,
      document.estadoAnalitico,
      document.tienda,
      document.vendedor,
      document.totalNeto,
      document.totalBruto,
      document.contribucion,
      document.margen,
    ]
  );

  return result.rows[0].id;
}

async function upsertLine(client, documentId, line) {
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
     VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12,
        $13, $14, $15, $16, $17, $18,
        $19, $20, $21, $22
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
    [
      documentId,
      line.lineaSap,
      line.codigoItem,
      line.descripcion,
      line.cantidad,
      line.cantidadAbierta,
      line.precioUnitario,
      line.precioSinIva,
      line.descuentoPct,
      line.totalBruto,
      line.totalNeto,
      line.totalBruto,
      line.costoUnitario,
      line.costoTotal,
      line.contribucion,
      line.margen,
      line.tipoLinea,
      line.targetType,
      line.targetEntry,
      line.baseType,
      line.baseEntry,
      line.baseLine,
    ]
  );
}

async function loadDestinationDocuments(client, targetEntries) {
  if (targetEntries.length === 0) {
    return new Map();
  }

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
    [targetEntries]
  );

  const destinations = new Map();

  for (const row of result.rows) {
    destinations.set(String(row.docentry_sap), row);
  }

  return destinations;
}

async function upsertRelation(
  client,
  documentId,
  line,
  destination
) {
  const tipoVenta =
    line.tipoVentaDestino ??
    destination?.tipo_documento ??
    null;

  const numeroDestino =
    line.numeroVentaDestino ??
    destination?.numero_documento ??
    null;

  const folioDestino =
    line.folioVentaDestino ??
    destination?.folio ??
    null;

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
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
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
    [
      documentId,
      line.lineaSap,
      line.targetType,
      line.targetEntry,
      destination?.id ?? null,
      tipoVenta,
      numeroDestino,
      folioDestino,
    ]
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
  };

  for (const document of documents.values()) {
    const documentId = await upsertDocument(
      client,
      importacionId,
      document
    );

    documentIds.set(document.key, documentId);
    summary.documentos[document.tipoDocumento] += 1;

    if (document.estadoAnalitico) {
      summary.estadosOF[document.estadoAnalitico] =
        (summary.estadosOF[document.estadoAnalitico] ?? 0) + 1;
    }

    for (const line of document.lines) {
      await upsertLine(client, documentId, line);

      summary.lineas += 1;

      if (line.tipoLinea === "SERVICIO") {
        summary.servicios += 1;
      } else {
        summary.productos += 1;
      }
    }
  }

  const offerRelations = [];

  for (const document of documents.values()) {
    if (document.tipoDocumento !== "OF") continue;

    const documentId = documentIds.get(document.key);

    for (const line of document.lines) {
      if (
        line.targetType === 13 &&
        line.targetEntry !== null &&
        line.targetEntry > 0
      ) {
        offerRelations.push({
          documentId,
          line,
        });
      }
    }
  }

  const targetEntries = [
    ...new Set(
      offerRelations.map(({ line }) => line.targetEntry)
    ),
  ];

  const destinations = await loadDestinationDocuments(
    client,
    targetEntries
  );

  for (const relation of offerRelations) {
    const destination = destinations.get(
      String(relation.line.targetEntry)
    );

    await upsertRelation(
      client,
      relation.documentId,
      relation.line,
      destination
    );

    summary.relaciones += 1;
  }

  return summary;
}
