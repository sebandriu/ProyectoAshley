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

function normalizeProductCodes(value) {
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

  if (filters.vendedor) {
    values.push(String(filters.vendedor).trim());
    conditions.push(`d.vendedor = $${values.length}`);
  }

  const productCodes = normalizeProductCodes(
    filters.productos ?? filters.producto
  );

  if (product && productCodes.length > 0) {
    values.push(productCodes);
    conditions.push(`
      EXISTS (
        SELECT 1
        FROM detalle_documento fdd
        WHERE fdd.documento_id = d.id
          AND fdd.tipo_linea = 'PRODUCTO'
          AND fdd.codigo_item = ANY($${values.length}::text[])
      )
    `);
  }

  return {
    where: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
    values,
    applied: {
      desde,
      hasta,
      tienda: filters.tienda ? String(filters.tienda).trim() : null,
      vendedor: filters.vendedor ? String(filters.vendedor).trim() : null,
      productos: productCodes,
    },
  };
}

export async function getAnalyticsFilterOptions() {
  const [periodResult, storesResult, sellersResult] =
    await Promise.all([
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
        `SELECT DISTINCT vendedor
         FROM documentos
         WHERE vendedor IS NOT NULL
           AND BTRIM(vendedor) <> ''
         ORDER BY vendedor`
      ),
    ]);

  return {
    periodoDisponible: {
      desde: periodResult.rows[0]?.desde ?? null,
      hasta: periodResult.rows[0]?.hasta ?? null,
    },
    tiendas: storesResult.rows.map((row) => row.tienda).filter(Boolean),
    vendedores: sellersResult.rows.map((row) => row.vendedor).filter(Boolean),
  };
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
        MAX(dd.descripcion) AS descripcion
      FROM detalle_documento dd
      WHERE dd.tipo_linea = 'PRODUCTO'
        AND dd.codigo_item IS NOT NULL
        AND BTRIM(dd.codigo_item) <> ''
        AND dd.codigo_item ILIKE '%' || $1 || '%'
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
  }));
}

export async function getProductAnalytics(filters = {}) {
  const { where, values, applied } = buildFilters(filters);

  const productConditions = [
    "dd.tipo_linea = 'PRODUCTO'",
    "dd.codigo_item IS NOT NULL",
    "BTRIM(dd.codigo_item) <> ''",
  ];

  const productCodes = normalizeProductCodes(
    filters.productos ?? filters.producto
  );

  if (productCodes.length > 0) {
    values.push(productCodes);
    productConditions.push(
      `dd.codigo_item = ANY($${values.length}::text[])`
    );
  }

  const documentWhere = where
    ? `${where} AND ${productConditions.join(" AND ")}`
    : `WHERE ${productConditions.join(" AND ")}`;

  const result = await pool.query(
    `
      SELECT
        dd.codigo_item AS codigo,
        MAX(dd.descripcion) AS descripcion,

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

  const result = await pool.query(
    `
      WITH base AS (
        SELECT
          d.id,
          d.tipo_documento,
          d.estado_analitico,
          d.cancelada_sap,
          d.total_bruto,
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
    vendedores,
  };
}

export async function getQuoteAnalytics(filters = {}) {
  const { where, values, applied } = buildFilters(filters, { product: true });
  const extra = where ? " AND d.tipo_documento = 'OF'" : "WHERE d.tipo_documento = 'OF'";

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
        COUNT(dd.id) FILTER (WHERE dd.tipo_linea = 'PRODUCTO') AS lineas_producto,
        COALESCE(SUM(dd.cantidad) FILTER (WHERE dd.tipo_linea = 'PRODUCTO'), 0) AS unidades_producto
      FROM documentos d
      LEFT JOIN detalle_documento dd ON dd.documento_id = d.id
      ${where}${extra}
      GROUP BY d.id
      ORDER BY d.fecha DESC, d.numero_documento DESC
      LIMIT 500
    `,
    values
  );

  return {
    filtros: applied,
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
    })),
  };
}

export async function getSalesAnalytics(filters = {}) {
  const { where, values, applied } = buildFilters(filters, { product: true });
  const extra = where
    ? " AND d.tipo_documento IN ('FR', 'FD')"
    : "WHERE d.tipo_documento IN ('FR', 'FD')";

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
        COUNT(dd.id) FILTER (WHERE dd.tipo_linea = 'PRODUCTO') AS lineas_producto,
        COALESCE(SUM(dd.cantidad) FILTER (WHERE dd.tipo_linea = 'PRODUCTO'), 0) AS unidades_producto
      FROM documentos d
      LEFT JOIN detalle_documento dd ON dd.documento_id = d.id
      ${where}${extra}
      GROUP BY d.id
      ORDER BY d.fecha DESC, d.numero_documento DESC
      LIMIT 500
    `,
    values
  );

  return {
    filtros: applied,
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
      unidadesProducto: numeric(row.unidades_producto),
    })),
  };
}
