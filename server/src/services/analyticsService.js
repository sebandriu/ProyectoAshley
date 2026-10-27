import { pool } from "../config/database.js";

function validateDate(value, fieldName) {
  if (!value) return null;

  const text = String(value).trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new Error(`${fieldName} debe usar el formato YYYY-MM-DD.`);
  }

  const date = new Date(`${text}T00:00:00Z`);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`${fieldName} no contiene una fecha válida.`);
  }

  return text;
}

function numeric(value) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function integer(value) {
  return Math.trunc(numeric(value));
}

function percentage(numerator, denominator) {
  if (denominator <= 0) return null;
  return Number(((numerator / denominator) * 100).toFixed(2));
}

function normalizeList(value) {
  const source = Array.isArray(value) ? value : [value];

  return [
    ...new Set(
      source
        .flatMap((item) => String(item ?? "").split(/[;,\n]+/))
        .map((item) => item.trim())
        .filter(Boolean)
    ),
  ];
}

function normalizeProductCodes(value) {
  return normalizeList(value);
}

function normalizeSellerNames(value) {
  return normalizeList(value);
}

// Un valor simple mantiene compatibilidad con enlaces anteriores.
// Las selecciones múltiples viajan como JSON, sin dividir nombres con comas.
function normalizeCategories(value) {
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => String(item ?? "").trim()).filter(Boolean))];
  }

  const source = String(value ?? "").trim();
  if (!source) return [];
  if (source.startsWith("[")) {
    try {
      const categories = JSON.parse(source);
      if (Array.isArray(categories)) return normalizeCategories(categories);
    } catch {
      // Los nombres simples que comiencen con "[" siguen siendo válidos.
    }
  }
  return [source];
}

function hasLineSelection(applied) {
  return applied.productos.length > 0 ||
    Boolean(applied.categoriasGenerales.length || applied.codigoAshley);
}

// Una misma condición reutilizada por los listados y los totales.
// Los importes filtrados provienen de las líneas, no del documento completo.
function linePredicate(alias, applied, values) {
  const terms = [`${alias}.tipo_linea = 'PRODUCTO'`];
  if (applied.productos.length) {
    values.push(applied.productos);
    terms.push(`${alias}.codigo_item = ANY($${values.length}::text[])`);
  }
  if (applied.categoriasGenerales.length) {
    values.push(applied.categoriasGenerales);
    terms.push(
      `COALESCE(NULLIF(BTRIM(${alias}.categoria_general), ''), 'SIN CATEGORIA') = ANY($${values.length}::text[])`
    );
  }
  if (applied.codigoAshley) {
    values.push(applied.codigoAshley);
    terms.push(`UPPER(BTRIM(COALESCE(${alias}.codigo_ashley, ''))) = UPPER($${values.length})`);
  }
  return terms.join(" AND ");
}

function buildFilters(filters = {}, { product = false } = {}) {
  const conditions = [];
  const values = [];

  const desde = validateDate(filters.desde, "desde");
  const hasta = validateDate(filters.hasta, "hasta");
  if (desde && hasta && desde > hasta) {
    throw new Error("La fecha desde no puede ser posterior a la fecha hasta.");
  }

  if (desde) {
    values.push(desde);
    conditions.push(`d.fecha >= $${values.length}::date`);
  }
  if (hasta) {
    values.push(hasta);
    conditions.push(`d.fecha <= $${values.length}::date`);
  }
  if (filters.tienda) {
    values.push(String(filters.tienda).trim());
    conditions.push(`d.tienda = $${values.length}`);
  }

  const applied = {
    desde,
    hasta,
    tienda: filters.tienda ? String(filters.tienda).trim() : null,
    vendedores: normalizeSellerNames(filters.vendedores ?? filters.vendedor),
    productos: normalizeProductCodes(filters.productos ?? filters.producto),
    categoriasGenerales: normalizeCategories(filters.categoriaGeneral),
    codigoAshley: String(filters.codigoAshley ?? "").trim(),
  };

  if (applied.vendedores.length) {
    values.push(applied.vendedores);
    conditions.push(`d.vendedor = ANY($${values.length}::text[])`);
  }
  if (product && hasLineSelection(applied)) {
    const match = linePredicate("fdd", applied, values);
    conditions.push(`EXISTS (
      SELECT 1 FROM detalle_documento fdd
      WHERE fdd.documento_id = d.id AND ${match}
    )`);
  }

  return {
    where: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
    values,
    applied,
  };
}

export async function getAnalyticsFilterOptions() {
  const [periodResult, storesResult, categoriesResult] = await Promise.all([
    pool.query(
      `SELECT
         TO_CHAR(MIN(fecha), 'YYYY-MM-DD') AS desde,
         TO_CHAR(MAX(fecha), 'YYYY-MM-DD') AS hasta
       FROM documentos`
    ),
    pool.query(
      `SELECT DISTINCT tienda
       FROM documentos
       WHERE tienda IS NOT NULL
         AND BTRIM(tienda) <> ''
       ORDER BY tienda`
    ),
    pool.query(
      `SELECT DISTINCT
         COALESCE(NULLIF(BTRIM(categoria_general), ''), 'SIN CATEGORIA') AS categoria
       FROM detalle_documento
       WHERE tipo_linea = 'PRODUCTO'
       ORDER BY categoria`
    ),
  ]);

  return {
    periodoDisponible: {
      desde: periodResult.rows[0]?.desde ?? null,
      hasta: periodResult.rows[0]?.hasta ?? null,
    },
    tiendas: storesResult.rows.map((row) => row.tienda).filter(Boolean),
    categoriasGenerales: categoriesResult.rows.map((row) => row.categoria),
  };
}

// Opciones reales para un desplegable, sin entrada de texto libre.
// La categoría restringe la lista sin modificar los datos originales.
export async function getAshleyCodeOptions(category = "") {
  const selectedCategories = normalizeCategories(category);
  const values = [];
  let byCategory = "";

  if (selectedCategories.length) {
    values.push(selectedCategories);
    byCategory = `AND COALESCE(
      NULLIF(BTRIM(dd.categoria_general), ''), 'SIN CATEGORIA'
    ) = ANY($1::text[])`;
  }

  const result = await pool.query(
    `
      SELECT
        UPPER(BTRIM(dd.codigo_ashley)) AS codigo,
        MAX(NULLIF(BTRIM(dd.descripcion), '')) AS descripcion
      FROM detalle_documento dd
      WHERE dd.tipo_linea = 'PRODUCTO'
        AND NULLIF(BTRIM(dd.codigo_ashley), '') IS NOT NULL
        ${byCategory}
      GROUP BY UPPER(BTRIM(dd.codigo_ashley))
      ORDER BY codigo
    `,
    values
  );

  return result.rows.map((row) => ({
    codigo: row.codigo,
    descripcion: row.descripcion ?? null,
  }));
}

export async function searchProductCodes(query, limit = 8) {
  const term = String(query ?? "").trim();

  if (!term) {
    return [];
  }

  const safeLimit = Math.min(Math.max(Number(limit) || 8, 1), 12);

  const result = await pool.query(
    `
      SELECT
        dd.codigo_item AS codigo,
        MAX(dd.descripcion) AS descripcion,
        MAX(NULLIF(BTRIM(dd.codigo_ashley), '')) AS codigo_ashley
      FROM detalle_documento dd
      WHERE dd.tipo_linea = 'PRODUCTO'
        AND dd.codigo_item IS NOT NULL
        AND BTRIM(dd.codigo_item) <> ''
        AND (
          dd.codigo_item ILIKE '%' || $1 || '%'
          OR dd.codigo_ashley ILIKE '%' || $1 || '%'
        )
      GROUP BY dd.codigo_item
      ORDER BY
        CASE
          WHEN UPPER(dd.codigo_item) = UPPER($1) THEN 0
          WHEN UPPER(dd.codigo_item) LIKE UPPER($1) || '%' THEN 1
          ELSE 2
        END,
        LENGTH(dd.codigo_item),
        dd.codigo_item
      LIMIT $2
    `,
    [term, safeLimit]
  );

  return result.rows.map((row) => ({
    codigo: row.codigo,
    descripcion: row.descripcion || row.codigo,
    codigoAshley: row.codigo_ashley,
  }));
}


export async function searchSellerNames(
  query,
  limit = 8,
  store = null
) {
  const term = String(query ?? "").trim();

  if (!term) {
    return [];
  }

  const safeLimit = Math.min(Math.max(Number(limit) || 8, 1), 12);
  const values = [term];
  const conditions = [
    "vendedor IS NOT NULL",
    "BTRIM(vendedor) <> ''",
    "vendedor ILIKE '%' || $1 || '%'",
  ];

  const normalizedStore = String(store ?? "").trim();

  if (normalizedStore) {
    values.push(normalizedStore);
    conditions.push("tienda = $" + values.length);
  }

  values.push(safeLimit);
  const limitParameter = "$" + values.length;

  const result = await pool.query(
    `
      WITH vendedores_disponibles AS (
        SELECT DISTINCT vendedor
        FROM documentos
        WHERE ${conditions.join(" AND ")}
      )
      SELECT vendedor
      FROM vendedores_disponibles
      ORDER BY
        CASE
          WHEN UPPER(vendedor) = UPPER($1) THEN 0
          WHEN UPPER(vendedor) LIKE UPPER($1) || '%' THEN 1
          ELSE 2
        END,
        LENGTH(vendedor),
        vendedor
      LIMIT ${limitParameter}
    `,
    values
  );

  return result.rows
    .map((row) => row.vendedor)
    .filter(Boolean);
}

export async function getProductAnalytics(filters = {}) {
  const { where, values, applied } = buildFilters(filters);

  const productConditions = [
    "dd.tipo_linea = 'PRODUCTO'",
    "dd.codigo_item IS NOT NULL",
    "BTRIM(dd.codigo_item) <> ''",
  ];

  if (hasLineSelection(applied)) {
    productConditions.push(linePredicate("dd", applied, values));
  }

  const documentWhere = where
    ? `${where} AND ${productConditions.join(" AND ")}`
    : `WHERE ${productConditions.join(" AND ")}`;

  const result = await pool.query(
    `
      SELECT
        dd.codigo_item AS codigo,
        MAX(dd.descripcion) AS descripcion,
        (
          ARRAY_AGG(NULLIF(BTRIM(dd.codigo_ashley), '')
            ORDER BY d.fecha DESC, d.id DESC)
          FILTER (WHERE NULLIF(BTRIM(dd.codigo_ashley), '') IS NOT NULL)
        )[1] AS codigo_ashley,
        COALESCE((
          ARRAY_AGG(NULLIF(BTRIM(dd.categoria_general), '')
            ORDER BY d.fecha DESC, d.id DESC)
          FILTER (WHERE NULLIF(BTRIM(dd.categoria_general), '') IS NOT NULL)
        )[1], 'SIN CATEGORIA') AS categoria_general,

        COALESCE(SUM(
          CASE
            WHEN d.tipo_documento = 'OF'
              AND d.estado_analitico <> 'CANCELADA'
            THEN GREATEST(COALESCE(dd.cantidad, 0), 0)
            ELSE 0
          END
        ), 0) AS unidades_cotizadas,

        COALESCE(SUM(
          CASE
            WHEN d.tipo_documento = 'OF'
              AND d.estado_analitico <> 'CANCELADA'
              AND dd.target_type = 13
              AND COALESCE(dd.target_entry, 0) > 0
            THEN GREATEST(
              COALESCE(dd.cantidad, 0) - COALESCE(dd.cantidad_abierta, 0),
              0
            )
            ELSE 0
          END
        ), 0) AS unidades_convertidas,

        COALESCE(SUM(
          CASE
            WHEN d.tipo_documento = 'OF'
              AND d.estado_analitico <> 'CANCELADA'
              AND dd.target_type = 13
              AND COALESCE(dd.target_entry, 0) > 0
            THEN GREATEST(COALESCE(dd.cantidad_abierta, 0), 0)
            WHEN d.tipo_documento = 'OF'
              AND d.estado_analitico <> 'CANCELADA'
            THEN GREATEST(COALESCE(dd.cantidad, 0), 0)
            ELSE 0
          END
        ), 0) AS demanda_no_convertida,

        COALESCE(SUM(
          CASE
            WHEN d.tipo_documento IN ('FR', 'FD')
              AND COALESCE(d.cancelada_sap, 'N') = 'N'
            THEN GREATEST(COALESCE(dd.cantidad, 0), 0)
            ELSE 0
          END
        ), 0) AS unidades_vendidas,

        COALESCE(SUM(
          CASE
            WHEN d.tipo_documento = 'OF'
              AND d.estado_analitico <> 'CANCELADA'
            THEN COALESCE(dd.total_bruto, 0)
            ELSE 0
          END
        ), 0) AS monto_cotizado,

        COALESCE(SUM(
          CASE
            WHEN d.tipo_documento IN ('FR', 'FD')
              AND COALESCE(d.cancelada_sap, 'N') = 'N'
            THEN COALESCE(dd.total_bruto, 0)
            ELSE 0
          END
        ), 0) AS monto_vendido

      FROM detalle_documento dd
      INNER JOIN documentos d ON d.id = dd.documento_id
      ${documentWhere}
      GROUP BY dd.codigo_item
      ORDER BY unidades_cotizadas DESC, demanda_no_convertida DESC, descripcion
    `,
    values
  );

  const products = result.rows.map((row) => {
    const quoted = numeric(row.unidades_cotizadas);
    const converted = numeric(row.unidades_convertidas);

    return {
      codigo: row.codigo,
      codigoAshley: row.codigo_ashley || null,
      categoriaGeneral: row.categoria_general || "SIN CATEGORIA",
      descripcion: row.descripcion || row.codigo,
      unidadesCotizadas: quoted,
      unidadesConvertidas: converted,
      demandaNoConvertida: numeric(row.demanda_no_convertida),
      unidadesVendidas: numeric(row.unidades_vendidas),
      conversionUnidadesPct: percentage(converted, quoted),
      montoCotizado: numeric(row.monto_cotizado),
      montoVendido: numeric(row.monto_vendido),
    };
  });

  const totals = products.reduce(
    (acc, product) => {
      acc.unidadesCotizadas += product.unidadesCotizadas;
      acc.unidadesConvertidas += product.unidadesConvertidas;
      acc.demandaNoConvertida += product.demandaNoConvertida;
      acc.unidadesVendidas += product.unidadesVendidas;
      acc.montoCotizado += product.montoCotizado;
      acc.montoVendido += product.montoVendido;
      return acc;
    },
    {
      unidadesCotizadas: 0,
      unidadesConvertidas: 0,
      demandaNoConvertida: 0,
      unidadesVendidas: 0,
      montoCotizado: 0,
      montoVendido: 0,
    }
  );

  totals.conversionUnidadesPct = percentage(
    totals.unidadesConvertidas,
    totals.unidadesCotizadas
  );

  return {
    filtros: applied,
    resumen: totals,
    productos: products,
  };
}

export async function getPerformanceAnalytics(filters = {}) {
  const { where, values, applied } = buildFilters(filters, { product: true });
  const amount = hasLineSelection(applied)
    ? `COALESCE((
        SELECT SUM(COALESCE(pdd.total_bruto, 0))
        FROM detalle_documento pdd
        WHERE pdd.documento_id = d.id AND ${linePredicate("pdd", applied, values)}
      ), 0)`
    : "d.total_bruto";

  const result = await pool.query(
    `
      WITH base AS (
        SELECT
          d.id,
          d.tipo_documento,
          d.estado_analitico,
          d.cancelada_sap,
          ${amount} AS total_bruto,
          d.tienda,
          d.vendedor
        FROM documentos d
        ${where}
      )
      SELECT
        tienda,
        vendedor,
        GROUPING(vendedor) AS agrupacion_vendedor,

        COUNT(*) FILTER (
          WHERE tipo_documento = 'OF'
        ) AS cotizaciones,
        COUNT(*) FILTER (
          WHERE tipo_documento = 'OF'
            AND estado_analitico = 'PENDIENTE'
        ) AS pendientes,

        COUNT(*) FILTER (
          WHERE tipo_documento IN ('FR', 'FD')
            AND COALESCE(cancelada_sap, 'N') = 'N'
        ) AS ventas,

        COUNT(*) FILTER (
          WHERE tipo_documento = 'OF'
            AND estado_analitico = 'CONVERTIDA COMPLETA'
        ) AS completas,

        COUNT(*) FILTER (
          WHERE tipo_documento = 'OF'
            AND estado_analitico = 'CONVERSION PARCIAL'
        ) AS parciales,

        COUNT(*) FILTER (
          WHERE tipo_documento = 'OF'
            AND estado_analitico = 'CERRADA SIN VENTA'
        ) AS cerradas_sin_venta,

        COALESCE(SUM(total_bruto) FILTER (
          WHERE tipo_documento IN ('FR', 'FD')
            AND COALESCE(cancelada_sap, 'N') = 'N'
        ), 0) AS monto_vendido

      FROM base
      GROUP BY GROUPING SETS ((tienda), (vendedor, tienda))
    `,
    values
  );

  // Actividad reciente = ventas en los 90 días previos a la última venta
  // importada. Es una señal comercial, NO una nómina laboral.
  const activityValues = [];
  const activityConditions = [
    "d.vendedor IS NOT NULL",
    "BTRIM(d.vendedor) <> ''",
    "d.tipo_documento IN ('FR', 'FD')",
    "COALESCE(d.cancelada_sap, 'N') = 'N'",
  ];

  if (applied.tienda) {
    activityValues.push(applied.tienda);
    activityConditions.push("d.tienda = $" + activityValues.length);
  }

  if (applied.vendedores?.length) {
    activityValues.push(applied.vendedores);
    activityConditions.push(
      "d.vendedor = ANY($" + activityValues.length + "::text[])"
    );
  }

  const activityResult = await pool.query(
    `
      WITH ultima_fecha AS (
        SELECT MAX(fecha) AS referencia
        FROM documentos
        WHERE tipo_documento IN ('FR', 'FD')
          AND COALESCE(cancelada_sap, 'N') = 'N'
      )
      SELECT
        d.vendedor,
        d.tienda,
        TO_CHAR(MAX(d.fecha), 'YYYY-MM-DD') AS ultima_venta,
        TO_CHAR(MAX(u.referencia), 'YYYY-MM-DD') AS fecha_referencia
      FROM documentos d
      CROSS JOIN ultima_fecha u
      WHERE ${activityConditions.join(" AND ")}
        AND d.fecha >= u.referencia - INTERVAL '90 days'
      GROUP BY d.vendedor, d.tienda
      ORDER BY MAX(d.fecha) DESC, d.vendedor
    `,
    activityValues
  );

  const vendedoresRecientes = activityResult.rows.map((row) => ({
    vendedor: row.vendedor,
    tienda: row.tienda,
    ultimaVenta: row.ultima_venta,
  }));
  const recientesPorClave = new Map(
    vendedoresRecientes.map((row) => [
      `${row.tienda ?? ""}|${row.vendedor ?? ""}`,
      row.ultimaVenta,
    ])
  );

  const mapRow = (row) => {
    const completas = integer(row.completas);
    const parciales = integer(row.parciales);
    const cerradas = integer(row.cerradas_sin_venta);
    const conVenta = completas + parciales;
    const resueltas = conVenta + cerradas;

    return {
      tienda: row.tienda,
      vendedor: row.vendedor,
      cotizaciones: integer(row.cotizaciones),
      pendientes: integer(row.pendientes),
      ventas: integer(row.ventas),
      conversionPct: percentage(conVenta, resueltas),
      montoVendido: numeric(row.monto_vendido),
    };
  };

  const tiendas = result.rows
    .filter(
      (row) =>
        row.tienda &&
        Number(row.agrupacion_vendedor) === 1
    )
    .map(mapRow)
    .sort((a, b) => b.montoVendido - a.montoVendido);

  const vendedores = result.rows
    .filter(
      (row) =>
        row.vendedor &&
        Number(row.agrupacion_vendedor) === 0
    )
    .map(mapRow)
    .sort((a, b) => b.montoVendido - a.montoVendido);

  return {
    filtros: applied,
    tiendas,
    vendedores: vendedores.map((row) => ({
      ...row,
      actividadReciente: recientesPorClave.has(
        `${row.tienda ?? ""}|${row.vendedor ?? ""}`
      ),
      ultimaVenta: recientesPorClave.get(
        `${row.tienda ?? ""}|${row.vendedor ?? ""}`
      ) ?? null,
    })),
    vendedoresRecientes,
    fechaReferenciaActividad: activityResult.rows[0]?.fecha_referencia ?? null,
  };
}

export async function getQuoteAnalytics(filters = {}) {
  const { where, values, applied } = buildFilters(filters, { product: true });
  const extra = where
    ? " AND d.tipo_documento = 'OF'"
    : "WHERE d.tipo_documento = 'OF'";

  const filtered = hasLineSelection(applied);
  const summaryValues = [...values];
  const amountSelected = filtered
    ? `COALESCE((
        SELECT SUM(COALESCE(sm.total_bruto, 0))
        FROM detalle_documento sm
        WHERE sm.documento_id = d.id
          AND ${linePredicate("sm", applied, summaryValues)}
      ), 0)`
    : "COALESCE(d.total_bruto, 0)";

  const summaryResult = await pool.query(
    `
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (
          WHERE d.estado_analitico = 'PENDIENTE'
        ) AS pendientes,
        COUNT(*) FILTER (
          WHERE d.estado_analitico IN (
            'CONVERTIDA COMPLETA',
            'CONVERSION PARCIAL'
          )
        ) AS con_venta,
        COUNT(*) FILTER (
          WHERE d.estado_analitico = 'CERRADA SIN VENTA'
        ) AS sin_venta,
        COALESCE(SUM(d.total_bruto), 0) AS monto,
        COALESCE(SUM(${amountSelected}), 0) AS monto_seleccionado
      FROM documentos d
      ${where}${extra}
    `,
    summaryValues
  );

  const summaryRow = summaryResult.rows[0];
  const pendingValues = [...values];
  const pendingAmount = filtered
    ? `COALESCE((
        SELECT SUM(COALESCE(pdd.total_bruto, 0))
        FROM detalle_documento pdd
        WHERE pdd.documento_id = d.id
          AND ${linePredicate("pdd", applied, pendingValues)}
      ), 0)`
    : "COALESCE(d.total_bruto, 0)";
  const pendingResult = await pool.query(
    `SELECT d.numero_documento, TO_CHAR(d.fecha, 'YYYY-MM-DD') AS fecha,
            d.tienda, ${pendingAmount} AS monto
     FROM documentos d
     ${where}${extra}
       AND d.estado_analitico = 'PENDIENTE'
     ORDER BY monto DESC, d.fecha ASC
     LIMIT 5`,
    pendingValues
  );
  let matchingSelect = `
    '[]'::jsonb AS productos_coincidentes,
    0::integer AS cantidad_coincidencias,
    NULL::numeric AS unidades_coincidentes
  `;

  if (filtered) {
    const matches = linePredicate("md", applied, values);
    const countMatch = linePredicate("mc", applied, values);
    const unitsMatch = linePredicate("mu", applied, values);

    matchingSelect = `
      COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'codigo', coincidencias.codigo_item,
            'codigoAshley', coincidencias.codigo_ashley,
            'cantidad', coincidencias.cantidad,
            'montoBruto', coincidencias.monto_bruto
          ) ORDER BY coincidencias.monto_bruto DESC
        )
        FROM (
          SELECT md.codigo_item,
            MAX(NULLIF(BTRIM(md.codigo_ashley), '')) AS codigo_ashley,
            SUM(COALESCE(md.cantidad, 0)) AS cantidad,
            SUM(COALESCE(md.total_bruto, 0)) AS monto_bruto
          FROM detalle_documento md
          WHERE md.documento_id = d.id AND ${matches}
          GROUP BY md.codigo_item
        ) coincidencias
      ), '[]'::jsonb) AS productos_coincidentes,
      (SELECT COUNT(DISTINCT mc.codigo_item)
       FROM detalle_documento mc
       WHERE mc.documento_id = d.id AND ${countMatch}
      ) AS cantidad_coincidencias,
      COALESCE((SELECT SUM(COALESCE(mu.cantidad, 0))
        FROM detalle_documento mu
        WHERE mu.documento_id = d.id AND ${unitsMatch}), 0
      ) AS unidades_coincidentes
    `;
  }

  const sortColumns = {
    fecha: "d.fecha",
    numero: "d.numero_documento",
    estado: "d.estado_analitico",
    tienda: "d.tienda",
    vendedor: "d.vendedor",
    productos: "lineas_producto",
    unidades: "unidades_producto",
    coincidencias: "cantidad_coincidencias",
    unidadesCoincidentes: "unidades_coincidentes",
    totalBruto: "d.total_bruto",
  };

  const orderBy =
    sortColumns[String(filters.orderBy ?? "")] ?? sortColumns.fecha;
  const orderDir =
    String(filters.orderDir ?? "").toLowerCase() === "asc"
      ? "ASC"
      : "DESC";

  const pageSize = 100;
  const totalRows = integer(summaryRow.total);
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const requestedPage = Math.max(1, Math.trunc(Number(filters.page) || 1));
  const page = Math.min(requestedPage, totalPages);
  values.push((page - 1) * pageSize);
  const offsetParam = "$" + values.length;

  const result = await pool.query(
    `
      SELECT
        d.docentry_sap,
        d.numero_documento,
        TO_CHAR(d.fecha, 'YYYY-MM-DD') AS fecha,
        d.estado_sap,
        d.estado_analitico,
        d.tienda,
        d.vendedor,
        d.total_bruto,
        COUNT(dd.id) FILTER (
          WHERE dd.tipo_linea = 'PRODUCTO'
        ) AS lineas_producto,
        COALESCE(
          SUM(dd.cantidad) FILTER (
            WHERE dd.tipo_linea = 'PRODUCTO'
          ),
          0
        ) AS unidades_producto,
        ${matchingSelect}
      FROM documentos d
      LEFT JOIN detalle_documento dd ON dd.documento_id = d.id
      ${where}${extra}
      GROUP BY d.id
      ORDER BY ${orderBy} ${orderDir} NULLS LAST,
               d.fecha DESC,
               d.numero_documento DESC
      LIMIT 100 OFFSET ${offsetParam}
    `,
    values
  );

  return {
    filtros: applied,
    paginacion: { pagina: page, paginas: totalPages, total: totalRows, porPagina: pageSize },
    resumen: {
      total: integer(summaryRow.total),
      pendientes: integer(summaryRow.pendientes),
      conVenta: integer(summaryRow.con_venta),
      sinVenta: integer(summaryRow.sin_venta),
      monto: numeric(summaryRow.monto),
      montoSeleccionado: numeric(summaryRow.monto_seleccionado),
      montoEsFiltrado: filtered,
      tasaCierrePct: percentage(
        integer(summaryRow.con_venta),
        integer(summaryRow.con_venta) + integer(summaryRow.sin_venta)
      ),
    },
    topPendientes: pendingResult.rows.map((row) => ({
      numero: row.numero_documento,
      fecha: row.fecha,
      tienda: row.tienda,
      monto: numeric(row.monto),
    })),
    orden: {
      campo: String(filters.orderBy ?? "fecha"),
      direccion: orderDir.toLowerCase(),
    },
    cotizaciones: result.rows.map((row) => ({
      docentry: row.docentry_sap,
      numero: row.numero_documento,
      fecha: row.fecha,
      estadoSap: row.estado_sap,
      estadoAnalitico: row.estado_analitico,
      tienda: row.tienda,
      vendedor: row.vendedor,
      totalBruto: numeric(row.total_bruto),
      lineasProducto: integer(row.lineas_producto),
      unidadesProducto: numeric(row.unidades_producto),
      productosCoincidentes: Array.isArray(row.productos_coincidentes)
        ? row.productos_coincidentes.map((item) => ({
            codigo: item.codigo,
            codigoAshley: item.codigoAshley ?? null,
            cantidad: numeric(item.cantidad),
            montoBruto: numeric(item.montoBruto),
          }))
        : [],
      cantidadCoincidencias: integer(row.cantidad_coincidencias),
      unidadesCoincidentes:
        row.unidades_coincidentes === null
          ? null
          : numeric(row.unidades_coincidentes),
    })),
  };
}

export async function getSalesAnalytics(filters = {}) {
  const { where, values, applied } = buildFilters(filters, { product: true });
  const extra = where
    ? " AND d.tipo_documento IN ('FR', 'FD')"
    : "WHERE d.tipo_documento IN ('FR', 'FD')";

  const hasProductFilter = hasLineSelection(applied);

  const summaryValues = [...values];
  let summaryAmountExpression = "COALESCE(d.total_bruto, 0)";

  if (hasProductFilter) {
    const matched = linePredicate("sd", applied, summaryValues);
    summaryAmountExpression = `COALESCE((
      SELECT SUM(COALESCE(sd.total_bruto, 0))
      FROM detalle_documento sd
      WHERE sd.documento_id = d.id AND ${matched}
    ), 0)`;
  }

  const summaryResult = await pool.query(
    `
      SELECT
        COUNT(*) FILTER (
          WHERE COALESCE(d.cancelada_sap, 'N') = 'N'
        ) AS validas,
        COUNT(*) FILTER (
          WHERE d.tipo_documento = 'FR'
            AND COALESCE(d.cancelada_sap, 'N') = 'N'
        ) AS fr,
        COUNT(*) FILTER (
          WHERE d.tipo_documento = 'FD'
            AND COALESCE(d.cancelada_sap, 'N') = 'N'
        ) AS fd,
        COUNT(*) FILTER (
          WHERE COALESCE(d.cancelada_sap, 'N') <> 'N'
        ) AS canceladas,
        COALESCE(
          SUM(
            CASE
              WHEN COALESCE(d.cancelada_sap, 'N') = 'N'
              THEN ${summaryAmountExpression}
              ELSE 0
            END
          ),
          0
        ) AS monto
      FROM documentos d
      ${where}${extra}
    `,
    summaryValues
  );

  const productSummaryValues = [...values];
  const matched = linePredicate("dd", applied, productSummaryValues);
  const productSummaryResult = await pool.query(
    `
      SELECT
        dd.codigo_item AS codigo,
        MAX(dd.descripcion) AS descripcion,
        MAX(NULLIF(BTRIM(dd.codigo_ashley), '')) AS codigo_ashley,
        COALESCE(SUM(dd.cantidad), 0) AS unidades_vendidas,
        COALESCE(SUM(dd.total_bruto), 0) AS monto_vendido,
        COUNT(DISTINCT d.id) AS documentos,
        COUNT(DISTINCT d.id) FILTER (WHERE d.tipo_documento = 'FR') AS fr,
        COUNT(DISTINCT d.id) FILTER (WHERE d.tipo_documento = 'FD') AS fd
      FROM documentos d
      INNER JOIN detalle_documento dd ON dd.documento_id = d.id
      ${where}${extra}
        AND COALESCE(d.cancelada_sap, 'N') = 'N'
        AND ${matched}
      GROUP BY dd.codigo_item
      ORDER BY monto_vendido DESC
      LIMIT 8
    `,
    productSummaryValues
  );

  const resumenProductos = productSummaryResult.rows.map((row) => ({
    codigo: row.codigo,
    codigoAshley: row.codigo_ashley,
    descripcion: row.descripcion || row.codigo,
    unidadesVendidas: numeric(row.unidades_vendidas),
    montoVendido: numeric(row.monto_vendido),
    documentos: integer(row.documentos),
    fr: integer(row.fr),
    fd: integer(row.fd),
  }));

  let matchingSelect = `
    '[]'::jsonb AS productos_coincidentes,
    NULL::numeric AS monto_coincidente
  `;

  if (hasProductFilter) {
    const matchRows = linePredicate("md", applied, values);
    const matchAmount = linePredicate("mm", applied, values);
    matchingSelect = `
      COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'codigo', coincidence.codigo_item,
            'codigoAshley', coincidence.codigo_ashley,
            'descripcion', coincidence.descripcion,
            'cantidad', coincidence.cantidad,
            'montoBruto', coincidence.monto_bruto
          ) ORDER BY coincidence.monto_bruto DESC
        )
        FROM (
          SELECT md.codigo_item,
            MAX(NULLIF(BTRIM(md.codigo_ashley), '')) AS codigo_ashley,
            MAX(md.descripcion) AS descripcion,
            SUM(COALESCE(md.cantidad, 0)) AS cantidad,
            SUM(COALESCE(md.total_bruto, 0)) AS monto_bruto
          FROM detalle_documento md
          WHERE md.documento_id = d.id AND ${matchRows}
          GROUP BY md.codigo_item
        ) coincidence
      ), '[]'::jsonb) AS productos_coincidentes,
      COALESCE((
        SELECT SUM(COALESCE(mm.total_bruto, 0))
        FROM detalle_documento mm
        WHERE mm.documento_id = d.id AND ${matchAmount}
      ), 0) AS monto_coincidente
    `;
  }

  const sortColumns = {
    fecha: "d.fecha",
    tipo: "d.tipo_documento",
    numero: "d.numero_documento",
    folio: "d.folio",
    estado: "d.cancelada_sap",
    tienda: "d.tienda",
    vendedor: "d.vendedor",
    productos: "productos_distintos",
    unidades: "unidades_producto",
    montoSeleccionado: hasProductFilter
      ? "monto_coincidente"
      : "d.total_bruto",
    totalBruto: "d.total_bruto",
  };

  const requestedOrder = String(filters.orderBy ?? "fecha");
  const orderBy = sortColumns[requestedOrder] ?? sortColumns.fecha;
  const orderDir =
    String(filters.orderDir ?? "").toLowerCase() === "asc"
      ? "ASC"
      : "DESC";

  const summaryRow = summaryResult.rows[0];
  const pageSize = 100;
  const totalRows = integer(summaryRow.validas) + integer(summaryRow.canceladas);
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const requestedPage = Math.max(1, Math.trunc(Number(filters.page) || 1));
  const page = Math.min(requestedPage, totalPages);
  values.push((page - 1) * pageSize);
  const offsetParam = "$" + values.length;

  const result = await pool.query(
    `
      SELECT
        d.tipo_documento,
        d.docentry_sap,
        d.numero_documento,
        d.folio,
        TO_CHAR(d.fecha, 'YYYY-MM-DD') AS fecha,
        d.cancelada_sap,
        d.tienda,
        d.vendedor,
        d.total_bruto,
        COUNT(dd.id) FILTER (
          WHERE dd.tipo_linea = 'PRODUCTO'
        ) AS lineas_producto,
        COUNT(DISTINCT dd.codigo_item) FILTER (
          WHERE dd.tipo_linea = 'PRODUCTO'
            AND dd.codigo_item IS NOT NULL
        ) AS productos_distintos,
        COALESCE(
          SUM(dd.cantidad) FILTER (
            WHERE dd.tipo_linea = 'PRODUCTO'
          ),
          0
        ) AS unidades_producto,
        ${matchingSelect}
      FROM documentos d
      LEFT JOIN detalle_documento dd ON dd.documento_id = d.id
      ${where}${extra}
      GROUP BY d.id
      ORDER BY ${orderBy} ${orderDir} NULLS LAST,
               d.fecha DESC,
               d.numero_documento DESC
      LIMIT 100 OFFSET ${offsetParam}
    `,
    values
  );

  return {
    filtros: applied,
    paginacion: { pagina: page, paginas: totalPages, total: totalRows, porPagina: pageSize },
    resumen: {
      validas: integer(summaryRow.validas),
      fr: integer(summaryRow.fr),
      fd: integer(summaryRow.fd),
      canceladas: integer(summaryRow.canceladas),
      monto: numeric(summaryRow.monto),
      montoEsFiltrado: hasProductFilter,
    },
    resumenProductos,
    orden: {
      campo: requestedOrder,
      direccion: orderDir.toLowerCase(),
    },
    ventas: result.rows.map((row) => ({
      tipo: row.tipo_documento,
      docentry: row.docentry_sap,
      numero: row.numero_documento,
      folio: row.folio,
      fecha: row.fecha,
      canceladaSap: row.cancelada_sap,
      valida: (row.cancelada_sap ?? "N") === "N",
      tienda: row.tienda,
      vendedor: row.vendedor,
      totalBruto: numeric(row.total_bruto),
      lineasProducto: integer(row.lineas_producto),
      productosDistintos: integer(row.productos_distintos),
      unidadesProducto: numeric(row.unidades_producto),
      productosCoincidentes: Array.isArray(row.productos_coincidentes)
        ? row.productos_coincidentes.map((item) => ({
            codigo: item.codigo,
            codigoAshley: item.codigoAshley ?? null,
            descripcion: item.descripcion || item.codigo,
            cantidad: numeric(item.cantidad),
            montoBruto: numeric(item.montoBruto),
          }))
        : [],
      montoCoincidente:
        row.monto_coincidente === null
          ? null
          : numeric(row.monto_coincidente),
    })),
  };
}

