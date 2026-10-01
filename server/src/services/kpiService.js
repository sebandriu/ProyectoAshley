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

function buildDocumentFilters(filters = {}) {
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

  return {
    where:
      conditions.length > 0
        ? `WHERE ${conditions.join(" AND ")}`
        : "",
    values,
    applied: {
      desde,
      hasta,
      tienda: filters.tienda ? String(filters.tienda).trim() : null,
      vendedor: filters.vendedor
        ? String(filters.vendedor).trim()
        : null,
    },
  };
}

function numeric(value) {
  if (value === null || value === undefined) return 0;

  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function integer(value) {
  return Math.trunc(numeric(value));
}

function percentage(numerator, denominator) {
  if (denominator <= 0) return null;

  return Number(((numerator / denominator) * 100).toFixed(2));
}

export async function getKpiSummary(filters = {}) {
  const { where, values, applied } = buildDocumentFilters(filters);

  const result = await pool.query(
    `
      WITH base AS (
        SELECT
          d.id,
          d.tipo_documento,
          d.fecha,
          d.estado_analitico,
          d.cancelada_sap,
          d.total_neto,
          d.total_bruto,
          d.tienda,
          d.vendedor
        FROM documentos d
        ${where}
      )
      SELECT
        COUNT(*) FILTER (
          WHERE tipo_documento = 'OF'
        ) AS cotizaciones_total,

        COUNT(*) FILTER (
          WHERE tipo_documento = 'OF'
            AND estado_analitico <> 'CANCELADA'
        ) AS cotizaciones_validas,

        COUNT(*) FILTER (
          WHERE tipo_documento = 'OF'
            AND estado_analitico = 'PENDIENTE'
        ) AS pendientes,

        COUNT(*) FILTER (
          WHERE tipo_documento = 'OF'
            AND estado_analitico = 'CONVERTIDA COMPLETA'
        ) AS convertidas_completas,

        COUNT(*) FILTER (
          WHERE tipo_documento = 'OF'
            AND estado_analitico = 'CONVERSION PARCIAL'
        ) AS conversiones_parciales,

        COUNT(*) FILTER (
          WHERE tipo_documento = 'OF'
            AND estado_analitico = 'CERRADA SIN VENTA'
        ) AS cerradas_sin_venta,

        COUNT(*) FILTER (
          WHERE tipo_documento = 'OF'
            AND estado_analitico = 'CANCELADA'
        ) AS canceladas,

        COUNT(*) FILTER (
          WHERE tipo_documento IN ('FR', 'FD')
            AND COALESCE(cancelada_sap, 'N') = 'N'
        ) AS ventas,

        COUNT(*) FILTER (
          WHERE tipo_documento = 'FR'
            AND COALESCE(cancelada_sap, 'N') = 'N'
        ) AS ventas_fr,

        COUNT(*) FILTER (
          WHERE tipo_documento = 'FD'
            AND COALESCE(cancelada_sap, 'N') = 'N'
        ) AS ventas_fd,

        COALESCE(
          SUM(total_neto) FILTER (
            WHERE tipo_documento = 'OF'
              AND estado_analitico <> 'CANCELADA'
          ),
          0
        ) AS monto_cotizado_neto,

        COALESCE(
          SUM(total_bruto) FILTER (
            WHERE tipo_documento = 'OF'
              AND estado_analitico <> 'CANCELADA'
          ),
          0
        ) AS monto_cotizado_bruto,

        COALESCE(
          SUM(total_neto) FILTER (
            WHERE tipo_documento IN ('FR', 'FD')
              AND COALESCE(cancelada_sap, 'N') = 'N'
          ),
          0
        ) AS monto_vendido_neto,

        COALESCE(
          SUM(total_bruto) FILTER (
            WHERE tipo_documento IN ('FR', 'FD')
              AND COALESCE(cancelada_sap, 'N') = 'N'
          ),
          0
        ) AS monto_vendido_bruto,

        COALESCE(
          AVG(total_bruto) FILTER (
            WHERE tipo_documento IN ('FR', 'FD')
              AND COALESCE(cancelada_sap, 'N') = 'N'
          ),
          0
        ) AS ticket_promedio_bruto,

        MIN(fecha) AS fecha_minima,
        MAX(fecha) AS fecha_maxima
      FROM base
    `,
    values
  );

  const row = result.rows[0];

  const pendientes = integer(row.pendientes);
  const convertidasCompletas = integer(row.convertidas_completas);
  const conversionesParciales = integer(row.conversiones_parciales);
  const cerradasSinVenta = integer(row.cerradas_sin_venta);
  const canceladas = integer(row.canceladas);

  const convertidasConVenta =
    convertidasCompletas + conversionesParciales;

  const ofertasResueltas =
    convertidasConVenta + cerradasSinVenta;

  return {
    filtros: applied,
    periodoDisponible: {
      desde: row.fecha_minima ?? null,
      hasta: row.fecha_maxima ?? null,
    },
    cotizaciones: {
      total: integer(row.cotizaciones_total),
      validas: integer(row.cotizaciones_validas),
      pendientes,
      convertidasCompletas,
      conversionesParciales,
      cerradasSinVenta,
      canceladas,
      resueltas: ofertasResueltas,
      conVenta: convertidasConVenta,
    },
    conversion: {
      resueltasPct: percentage(
        convertidasConVenta,
        ofertasResueltas
      ),
      completasPct: percentage(
        convertidasCompletas,
        ofertasResueltas
      ),
      pendientesExcluidasDelCalculo: pendientes,
      canceladasExcluidasDelCalculo: canceladas,
    },
    ventas: {
      total: integer(row.ventas),
      fr: integer(row.ventas_fr),
      fd: integer(row.ventas_fd),
    },
    montos: {
      cotizadoNeto: numeric(row.monto_cotizado_neto),
      cotizadoBruto: numeric(row.monto_cotizado_bruto),
      vendidoNeto: numeric(row.monto_vendido_neto),
      vendidoBruto: numeric(row.monto_vendido_bruto),
      ticketPromedioBruto: numeric(row.ticket_promedio_bruto),
    },
  };
}


export async function getKpiFilterOptions() {
  const [periodResult, datesResult, storesResult] = await Promise.all([
    pool.query(
      `SELECT
         TO_CHAR(MIN(fecha), 'YYYY-MM-DD') AS desde,
         TO_CHAR(MAX(fecha), 'YYYY-MM-DD') AS hasta
       FROM documentos`
    ),
    pool.query(
      `SELECT DISTINCT TO_CHAR(fecha, 'YYYY-MM-DD') AS fecha
       FROM documentos
       WHERE fecha IS NOT NULL
       ORDER BY fecha`
    ),
    pool.query(
      `SELECT DISTINCT tienda
       FROM documentos
       WHERE tienda IS NOT NULL
         AND BTRIM(tienda) <> ''
       ORDER BY tienda`
    ),
  ]);

  return {
    periodoDisponible: {
      desde: periodResult.rows[0]?.desde ?? null,
      hasta: periodResult.rows[0]?.hasta ?? null,
    },
    fechas: datesResult.rows
      .map((row) => row.fecha)
      .filter(Boolean),
    tiendas: storesResult.rows
      .map((row) => row.tienda)
      .filter(Boolean),
  };
}


export async function getKpiEvolution(filters = {}) {
  const { where, values, applied } = buildDocumentFilters(filters);

  const result = await pool.query(
    `
      WITH base AS (
        SELECT
          d.tipo_documento,
          d.fecha,
          d.estado_analitico,
          d.cancelada_sap,
          d.tienda,
          d.vendedor
        FROM documentos d
        ${where}
      )
      SELECT
        TO_CHAR(fecha, 'YYYY-MM-DD') AS fecha,

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
        ) AS convertidas_completas,

        COUNT(*) FILTER (
          WHERE tipo_documento = 'OF'
            AND estado_analitico = 'CONVERSION PARCIAL'
        ) AS conversiones_parciales,

        COUNT(*) FILTER (
          WHERE tipo_documento = 'OF'
            AND estado_analitico = 'CERRADA SIN VENTA'
        ) AS cerradas_sin_venta

      FROM base
      WHERE fecha IS NOT NULL
      GROUP BY fecha
      ORDER BY fecha
    `,
    values
  );

  return {
    filtros: applied,
    puntos: result.rows.map((row) => {
      const completas = integer(row.convertidas_completas);
      const parciales = integer(row.conversiones_parciales);
      const cerradasSinVenta = integer(row.cerradas_sin_venta);

      const conVenta = completas + parciales;
      const resueltas = conVenta + cerradasSinVenta;

      return {
        fecha: row.fecha,
        cotizaciones: integer(row.cotizaciones),
        ventas: integer(row.ventas),
        conversion: percentage(conVenta, resueltas),
      };
    }),
  };
}
