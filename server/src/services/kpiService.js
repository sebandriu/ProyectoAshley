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

function round(value, decimals = 2) {
  if (!Number.isFinite(Number(value))) return null;
  return Number(Number(value).toFixed(decimals));
}

function percentage(numerator, denominator) {
  if (denominator <= 0) return null;

  return round((numerator / denominator) * 100);
}

function percentageChange(current, previous) {
  const currentValue = numeric(current);
  const previousValue = numeric(previous);

  if (previousValue === 0) return null;

  return round(((currentValue - previousValue) / Math.abs(previousValue)) * 100);
}

function parseIsoDate(value) {
  return new Date(`${value}T00:00:00Z`);
}

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function monthEnd(date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)
  );
}

function previousMonthDate(date, day) {
  const previousMonth = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 1)
  );
  const lastDay = monthEnd(previousMonth).getUTCDate();

  return new Date(
    Date.UTC(
      previousMonth.getUTCFullYear(),
      previousMonth.getUTCMonth(),
      Math.min(day, lastDay)
    )
  );
}

function previousYearDate(date) {
  const year = date.getUTCFullYear() - 1;
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  return new Date(Date.UTC(year, month, Math.min(day, lastDay)));
}

function comparisonPeriod(applied) {
  if (!applied?.desde || !applied?.hasta) return null;

  const from = parseIsoDate(applied.desde);
  const to = parseIsoDate(applied.hasta);
  const durationDays =
    Math.round((to.getTime() - from.getTime()) / 86400000) + 1;

  if (durationDays <= 0) return null;

  const sameMonth =
    from.getUTCFullYear() === to.getUTCFullYear() &&
    from.getUTCMonth() === to.getUTCMonth();

  if (sameMonth && from.getUTCDate() === 1 && durationDays > 1) {
    const previousFrom = previousMonthDate(from, 1);
    const currentMonthEnd = monthEnd(from);
    const isFullMonth = to.getTime() === currentMonthEnd.getTime();
    const previousTo = isFullMonth
      ? monthEnd(previousFrom)
      : previousMonthDate(from, to.getUTCDate());

    return {
      desde: toIsoDate(previousFrom),
      hasta: toIsoDate(previousTo),
      tipo: isFullMonth ? "MES_ANTERIOR" : "MES_A_LA_FECHA",
    };
  }

  const sameYear = from.getUTCFullYear() === to.getUTCFullYear();

  if (
    sameYear &&
    from.getUTCMonth() === 0 &&
    from.getUTCDate() === 1 &&
    durationDays > 31
  ) {
    const previousFrom = new Date(
      Date.UTC(from.getUTCFullYear() - 1, 0, 1)
    );
    const isFullYear =
      to.getUTCMonth() === 11 && to.getUTCDate() === 31;
    const previousTo = isFullYear
      ? new Date(Date.UTC(to.getUTCFullYear() - 1, 11, 31))
      : previousYearDate(to);

    return {
      desde: toIsoDate(previousFrom),
      hasta: toIsoDate(previousTo),
      tipo: isFullYear ? "ANIO_ANTERIOR" : "ANIO_A_LA_FECHA",
    };
  }

  const previousTo = addDays(from, -1);
  const previousFrom = addDays(previousTo, -(durationDays - 1));

  return {
    desde: toIsoDate(previousFrom),
    hasta: toIsoDate(previousTo),
    tipo: "RANGO_ANTERIOR",
  };
}

function mapSnapshot(row, applied) {
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

async function querySnapshot(filters = {}) {
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

        TO_CHAR(MIN(fecha), 'YYYY-MM-DD') AS fecha_minima,
        TO_CHAR(MAX(fecha), 'YYYY-MM-DD') AS fecha_maxima
      FROM base
    `,
    values
  );

  return mapSnapshot(result.rows[0], applied);
}

function regressionStats(points) {
  const observations = points
    .map((point) => ({
      x: numeric(point.monto_cotizado),
      y: numeric(point.monto_vendido),
    }))
    .filter(
      (point) =>
        Number.isFinite(point.x) &&
        Number.isFinite(point.y)
    );

  const n = observations.length;

  if (n < 12) {
    return {
      disponible: false,
      observaciones: n,
      motivo: "Se requieren al menos 12 períodos mensuales comparables.",
    };
  }

  const meanX =
    observations.reduce((sum, point) => sum + point.x, 0) / n;
  const meanY =
    observations.reduce((sum, point) => sum + point.y, 0) / n;

  let sxx = 0;
  let syy = 0;
  let sxy = 0;

  observations.forEach((point) => {
    const dx = point.x - meanX;
    const dy = point.y - meanY;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  });

  if (sxx <= 0 || syy <= 0) {
    return {
      disponible: false,
      observaciones: n,
      motivo: "La serie histórica no tiene variación suficiente.",
    };
  }

  const pendiente = sxy / sxx;
  const intercepto = meanY - pendiente * meanX;
  const correlacion = sxy / Math.sqrt(sxx * syy);
  const r2 = correlacion * correlacion;

  return {
    disponible: true,
    observaciones: n,
    pendiente: round(pendiente, 6),
    intercepto: round(intercepto, 2),
    correlacion: round(correlacion, 4),
    r2: round(r2, 4),
  };
}

function isMonthlyEvaluation(applied) {
  if (!applied?.desde || !applied?.hasta) return false;

  const from = parseIsoDate(applied.desde);
  const to = parseIsoDate(applied.hasta);

  return (
    from.getUTCFullYear() === to.getUTCFullYear() &&
    from.getUTCMonth() === to.getUTCMonth() &&
    from.getUTCDate() === 1
  );
}

async function getSalesRegression(applied, currentSnapshot) {
  const conditions = [
    "d.fecha IS NOT NULL",
    "d.tipo_documento IN ('OF', 'FR', 'FD')",
  ];
  const values = [];

  const monthlyEvaluation = isMonthlyEvaluation(applied);
  let dayLimit = null;

  if (monthlyEvaluation) {
    const currentFrom = parseIsoDate(applied.desde);
    const currentTo = parseIsoDate(applied.hasta);
    const currentMonthStart = new Date(
      Date.UTC(
        currentFrom.getUTCFullYear(),
        currentFrom.getUTCMonth(),
        1
      )
    );

    values.push(toIsoDate(currentMonthStart));
    conditions.push(`d.fecha < $${values.length}::date`);

    dayLimit = currentTo.getUTCDate();
    const currentMonthLastDay = monthEnd(currentFrom).getUTCDate();

    if (dayLimit < currentMonthLastDay) {
      values.push(dayLimit);
      conditions.push(
        `EXTRACT(DAY FROM d.fecha) <= $${values.length}::int`
      );
    }
  } else if (applied?.hasta) {
    values.push(applied.hasta);
    conditions.push(`d.fecha <= $${values.length}::date`);
  }

  if (applied?.tienda) {
    values.push(applied.tienda);
    conditions.push(`d.tienda = $${values.length}`);
  }

  if (applied?.vendedor) {
    values.push(applied.vendedor);
    conditions.push(`d.vendedor = $${values.length}`);
  }

  const result = await pool.query(
    `
      SELECT
        TO_CHAR(DATE_TRUNC('month', d.fecha), 'YYYY-MM') AS periodo,
        COALESCE(
          SUM(d.total_bruto) FILTER (
            WHERE d.tipo_documento = 'OF'
              AND d.estado_analitico <> 'CANCELADA'
          ),
          0
        ) AS monto_cotizado,
        COALESCE(
          SUM(d.total_bruto) FILTER (
            WHERE d.tipo_documento IN ('FR', 'FD')
              AND COALESCE(d.cancelada_sap, 'N') = 'N'
          ),
          0
        ) AS monto_vendido
      FROM documentos d
      WHERE ${conditions.join(" AND ")}
      GROUP BY DATE_TRUNC('month', d.fecha)
      ORDER BY DATE_TRUNC('month', d.fecha)
    `,
    values
  );

  const stats = regressionStats(result.rows);

  if (!stats.disponible) {
    return {
      ...stats,
      granularidad: "MENSUAL",
      limiteDiaMes: dayLimit,
      evaluacion: {
        aplicable: false,
      },
    };
  }

  if (!monthlyEvaluation) {
    return {
      ...stats,
      granularidad: "MENSUAL",
      limiteDiaMes: dayLimit,
      evaluacion: {
        aplicable: false,
        motivo:
          "La señal ejecutiva se calcula cuando el período seleccionado corresponde a un mes o mes a la fecha.",
      },
    };
  }

  const quoted = currentSnapshot.montos.cotizadoBruto;
  const observed = currentSnapshot.montos.vendidoBruto;
  const expected = stats.intercepto + stats.pendiente * quoted;

  if (!Number.isFinite(expected) || expected <= 0) {
    return {
      ...stats,
      granularidad: "MENSUAL",
      limiteDiaMes: dayLimit,
      evaluacion: {
        aplicable: false,
        motivo:
          "La tendencia histórica no produce una referencia monetaria interpretable para este período.",
      },
    };
  }

  return {
    ...stats,
    granularidad: "MENSUAL",
    limiteDiaMes: dayLimit,
    evaluacion: {
      aplicable: true,
      montoCotizado: round(quoted, 2),
      montoVendidoObservado: round(observed, 2),
      montoVendidoTendencia: round(expected, 2),
      desviacionPct: percentageChange(observed, expected),
    },
  };
}

export async function getKpiSummary(filters = {}) {
  const current = await querySnapshot(filters);
  const previousPeriod = comparisonPeriod(current.filtros);

  let previous = null;

  if (previousPeriod) {
    previous = await querySnapshot({
      ...filters,
      desde: previousPeriod.desde,
      hasta: previousPeriod.hasta,
    });
  }

  const regression = await getSalesRegression(
    current.filtros,
    current
  );

  const currentClosure = current.conversion.resueltasPct;
  const previousClosure = previous?.conversion?.resueltasPct ?? null;

  return {
    ...current,
    comparacion: previousPeriod
      ? {
          actual: {
            desde: current.filtros.desde,
            hasta: current.filtros.hasta,
          },
          anterior: previousPeriod,
          valoresAnteriores: previous
            ? {
                montoVendidoBruto: previous.montos.vendidoBruto,
                ventas: previous.ventas.total,
                ticketPromedioBruto:
                  previous.montos.ticketPromedioBruto,
                cierreOfPct: previousClosure,
              }
            : null,
          variaciones: previous
            ? {
                montoVendidoPct: percentageChange(
                  current.montos.vendidoBruto,
                  previous.montos.vendidoBruto
                ),
                ventasPct: percentageChange(
                  current.ventas.total,
                  previous.ventas.total
                ),
                ticketPromedioPct: percentageChange(
                  current.montos.ticketPromedioBruto,
                  previous.montos.ticketPromedioBruto
                ),
                cierreOfPp:
                  currentClosure === null ||
                  previousClosure === null
                    ? null
                    : round(currentClosure - previousClosure),
              }
            : null,
        }
      : null,
    regresion: regression,
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

function getEvolutionGranularity(applied) {
  if (!applied?.desde || !applied?.hasta) return "month";

  const from = parseIsoDate(applied.desde);
  const to = parseIsoDate(applied.hasta);
  const days =
    Math.round((to.getTime() - from.getTime()) / 86400000) + 1;

  if (days <= 45) return "day";
  if (days <= 550) return "month";
  return "year";
}

async function querySalesSeries(filters, granularity) {
  const { where, values, applied } = buildDocumentFilters(filters);
  const truncUnit =
    granularity === "year"
      ? "year"
      : granularity === "month"
        ? "month"
        : "day";

  const result = await pool.query(
    `
      SELECT
        TO_CHAR(
          DATE_TRUNC('${truncUnit}', d.fecha),
          'YYYY-MM-DD'
        ) AS periodo,
        COUNT(*) FILTER (
          WHERE d.tipo_documento IN ('FR', 'FD')
            AND COALESCE(d.cancelada_sap, 'N') = 'N'
        ) AS ventas,
        COALESCE(
          SUM(d.total_bruto) FILTER (
            WHERE d.tipo_documento IN ('FR', 'FD')
              AND COALESCE(d.cancelada_sap, 'N') = 'N'
          ),
          0
        ) AS monto_vendido
      FROM documentos d
      ${where}
      ${where ? "AND" : "WHERE"} d.fecha IS NOT NULL
      GROUP BY DATE_TRUNC('${truncUnit}', d.fecha)
      ORDER BY DATE_TRUNC('${truncUnit}', d.fecha)
    `,
    values
  );

  return {
    applied,
    rows: result.rows.map((row) => ({
      periodo: row.periodo,
      ventas: integer(row.ventas),
      montoVendido: numeric(row.monto_vendido),
    })),
  };
}

function bucketStart(date, granularity) {
  if (granularity === "year") {
    return new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  }

  if (granularity === "month") {
    return new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)
    );
  }

  return new Date(date);
}

function nextBucket(date, granularity) {
  const next = new Date(date);

  if (granularity === "year") {
    next.setUTCFullYear(next.getUTCFullYear() + 1, 0, 1);
    return next;
  }

  if (granularity === "month") {
    next.setUTCMonth(next.getUTCMonth() + 1, 1);
    return next;
  }

  next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

function fillSeries(rows, applied, granularity) {
  if (!applied?.desde || !applied?.hasta) return rows;

  const byPeriod = new Map(
    rows.map((row) => [row.periodo, row])
  );

  const from = bucketStart(parseIsoDate(applied.desde), granularity);
  const to = bucketStart(parseIsoDate(applied.hasta), granularity);
  const output = [];

  for (
    let cursor = from;
    cursor.getTime() <= to.getTime();
    cursor = nextBucket(cursor, granularity)
  ) {
    const period = toIsoDate(cursor);
    output.push(
      byPeriod.get(period) ?? {
        periodo: period,
        ventas: 0,
        montoVendido: 0,
      }
    );
  }

  return output;
}

export async function getKpiEvolution(filters = {}) {
  const applied = buildDocumentFilters(filters).applied;
  const previousPeriod = comparisonPeriod(applied);
  const granularity = getEvolutionGranularity(applied);

  const [currentResult, previousResult] = await Promise.all([
    querySalesSeries(filters, granularity),
    previousPeriod
      ? querySalesSeries(
          {
            ...filters,
            desde: previousPeriod.desde,
            hasta: previousPeriod.hasta,
          },
          granularity
        )
      : Promise.resolve(null),
  ]);

  const currentPoints = fillSeries(
    currentResult.rows,
    currentResult.applied,
    granularity
  );

  const previousPoints = previousResult
    ? fillSeries(
        previousResult.rows,
        previousResult.applied,
        granularity
      )
    : [];

  return {
    filtros: applied,
    granularidad: granularity,
    comparacion: previousPeriod,
    actual: currentPoints,
    anterior: previousPoints,
    puntos: currentPoints,
  };
}
