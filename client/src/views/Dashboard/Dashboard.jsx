import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  BadgeDollarSign,
  BarChart3,
  CircleDollarSign,
  Minus,
  Percent,
  ReceiptText,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import RadarChart from "../../components/RadarChart/RadarChart";

import {
  getKpiEvolution,
  getKpiSummary,
  getPerformanceAnalytics,
} from "../../services/api";

const integerFormatter = new Intl.NumberFormat("es-CL", {
  maximumFractionDigits: 0,
});

const currencyFormatter = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

const compactCurrencyFormatter = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  notation: "compact",
  maximumFractionDigits: 1,
});

function formatInteger(value) {
  return Number.isFinite(Number(value))
    ? integerFormatter.format(Number(value))
    : "—";
}

function formatCurrency(value) {
  return Number.isFinite(Number(value))
    ? currencyFormatter.format(Number(value))
    : "—";
}

function formatCompactCurrency(value) {
  return Number.isFinite(Number(value))
    ? compactCurrencyFormatter.format(Number(value))
    : "—";
}

function formatPercentValue(value) {
  if (value === null || value === undefined) return "—";

  return `${Number(value).toLocaleString("es-CL", {
    maximumFractionDigits: 1,
  })}%`;
}

function formatDecimal(value) {
  if (value === null || value === undefined) return "—";

  return Number(value).toLocaleString("es-CL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseDate(value) {
  return value ? new Date(`${value}T00:00:00Z`) : null;
}

function formatShortDate(value) {
  const date = parseDate(value);
  if (!date) return "—";

  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function formatPeriod(period) {
  if (!period?.desde || !period?.hasta) return "Período seleccionado";

  const from = parseDate(period.desde);
  const to = parseDate(period.hasta);

  const sameMonth =
    from.getUTCFullYear() === to.getUTCFullYear() &&
    from.getUTCMonth() === to.getUTCMonth();

  if (sameMonth && from.getUTCDate() === 1) {
    const lastDay = new Date(
      Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 0)
    ).getUTCDate();

    const monthLabel = new Intl.DateTimeFormat("es-CL", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(from);

    if (to.getUTCDate() === lastDay) {
      return monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
    }

    return `1–${to.getUTCDate()} ${monthLabel}`;
  }

  return `${formatShortDate(period.desde)} – ${formatShortDate(period.hasta)}`;
}

function formatBucket(value, granularity) {
  const date = parseDate(value);
  if (!date) return "";

  if (granularity === "year") {
    return String(date.getUTCFullYear());
  }

  if (granularity === "month") {
    return new Intl.DateTimeFormat("es-CL", {
      month: "short",
      timeZone: "UTC",
    })
      .format(date)
      .replace(".", "");
  }

  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

function variationMeta(value, unit = "%") {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) {
    return {
      tone: "neutral",
      Icon: Minus,
      text: "Sin base comparable",
    };
  }

  const number = Number(value);
  const absolute = Math.abs(number).toLocaleString("es-CL", {
    maximumFractionDigits: 1,
  });

  if (number < 0) {
    return {
      tone: "negative",
      Icon: TrendingDown,
      text: `↓ ${absolute}${unit} vs mismo período del año anterior`,
    };
  }

  if (number > 0) {
    return {
      tone: "positive",
      Icon: TrendingUp,
      text: `↑ ${absolute}${unit} vs período anterior`,
    };
  }

  return {
    tone: "neutral",
    Icon: Minus,
    text: `Sin variación interanual`,
  };
}

function ExecutiveKpi({ title, value, variation, unit, icon: Icon }) {
  const meta = variationMeta(variation, unit);
  const VariationIcon = meta.Icon;

  return (
    <article className="executive-kpi-card">
      <div className="executive-kpi-heading">
        <span className="executive-kpi-icon">
          <Icon size={17} strokeWidth={1.9} />
        </span>
        <span>{title}</span>
      </div>

      <strong className="executive-kpi-value">{value}</strong>

      <div className={`executive-kpi-variation ${meta.tone}`}>
        <VariationIcon size={14} strokeWidth={2} />
        <span>{meta.text}</span>
      </div>
    </article>
  );
}

function buildLinePath(points, getX, getY) {
  if (!points.length) return "";

  return points
    .map((point, index) => {
      const command = index === 0 ? "M" : "L";
      return `${command}${getX(index, points.length)},${getY(
        Number(point.montoVendido || 0)
      )}`;
    })
    .join(" ");
}

function SalesTrendChart({ actual = [], anterior = [], granularity = "day" }) {
  if (!actual.length) {
    return (
      <div className="executive-chart-empty">
        <BarChart3 size={22} strokeWidth={1.7} />
        <strong>Sin ventas para el período seleccionado</strong>
        <span>Prueba otro período o una tienda diferente.</span>
      </div>
    );
  }

  const width = 900;
  const height = 300;
  const padding = { top: 24, right: 24, bottom: 44, left: 70 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const maxAmount = Math.max(
    1,
    ...actual.map((point) => Number(point.montoVendido || 0)),
    ...anterior.map((point) => Number(point.montoVendido || 0))
  );

  const getX = (index, length) =>
    length <= 1
      ? padding.left + chartWidth / 2
      : padding.left + (index / (length - 1)) * chartWidth;

  const getY = (value) =>
    padding.top +
    chartHeight -
    (Number(value || 0) / maxAmount) * chartHeight;

  const actualPath = buildLinePath(actual, getX, getY);
  const previousPath = buildLinePath(anterior, getX, getY);

  const labelIndexes = new Set(
    Array.from({ length: Math.min(5, actual.length) }, (_, index) =>
      Math.round(
        (index / Math.max(1, Math.min(5, actual.length) - 1)) *
          (actual.length - 1)
      )
    )
  );

  return (
    <div className="executive-sales-chart">
      <div className="executive-chart-legend">
        <span><i className="executive-legend-line current" />Actual</span>
        {anterior.length > 0 && (
          <span><i className="executive-legend-line previous" />Año anterior</span>
        )}
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="executive-sales-svg"
        role="img"
        aria-label="Evolución del monto vendido comparada con el mismo período del año anterior"
      >
        {Array.from({ length: 5 }).map((_, index) => {
          const ratio = index / 4;
          const y = padding.top + chartHeight * ratio;
          const amount = maxAmount * (1 - ratio);

          return (
            <g key={`grid-${index}`}>
              <line
                className="executive-chart-grid"
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
              />
              <text
                className="executive-chart-axis"
                x={padding.left - 10}
                y={y + 4}
                textAnchor="end"
              >
                {formatCompactCurrency(amount)}
              </text>
            </g>
          );
        })}

        {previousPath && (
          <path
            d={previousPath}
            className="executive-sales-line previous"
          />
        )}

        <path
          d={actualPath}
          className="executive-sales-line current"
        />

        {actual.map((point, index) => {
          if (!labelIndexes.has(index)) return null;

          return (
            <text
              key={`label-${point.periodo}`}
              className="executive-chart-date"
              x={getX(index, actual.length)}
              y={height - 14}
              textAnchor="middle"
            >
              {formatBucket(point.periodo, granularity)}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

function rowKey(row, useSeller) {
  return useSeller
    ? `${row.tienda ?? ""}|${row.vendedor ?? ""}`
    : String(row.tienda ?? "");
}

function worstDimensionDrop(currentPerformance, previousPerformance, selectedStore) {
  const useSeller = Boolean(selectedStore);
  const currentRows = useSeller
    ? currentPerformance?.vendedores ?? []
    : currentPerformance?.tiendas ?? [];
  const previousRows = useSeller
    ? previousPerformance?.vendedores ?? []
    : previousPerformance?.tiendas ?? [];

  const currentMap = new Map(
    currentRows.map((row) => [rowKey(row, useSeller), row])
  );

  let worst = null;

  previousRows.forEach((previousRow) => {
    const previousAmount = Number(previousRow.montoVendido || 0);

    if (
      previousAmount <= 0 ||
      Number(previousRow.ventas || 0) < 3 ||
      (useSeller && !previousRow.actividadReciente)
    ) return;

    const key = rowKey(previousRow, useSeller);
    const currentRow = currentMap.get(key);
    const currentAmount = Number(currentRow?.montoVendido || 0);
    const variation =
      ((currentAmount - previousAmount) / previousAmount) * 100;

    if (!worst || variation < worst.variation) {
      worst = {
        label: useSeller
          ? previousRow.vendedor
          : previousRow.tienda,
        variation,
        type: useSeller ? "Vendedor" : "Tienda",
      };
    }
  });

  return worst && worst.variation < 0 ? worst : null;
}

function buildFocusItems({
  summary,
  currentPerformance,
  previousPerformance,
  selectedStore,
}) {
  const items = [];
  const variations = summary?.comparacion?.variaciones ?? {};
  const currentAmount = summary?.montos?.vendidoBruto ?? 0;
  const previousAmount =
    summary?.comparacion?.valoresAnteriores?.montoVendidoBruto;

  if (variations.montoVendidoPct != null && variations.montoVendidoPct < -5) {
    items.push({
      key: "sales-amount",
      title: "Monto vendido interanual",
      value: `↓ ${formatPercentValue(Math.abs(variations.montoVendidoPct))}`,
      detail: `${formatCurrency(currentAmount)} frente a ${formatCurrency(previousAmount)} en las mismas fechas del año anterior.`,
      tone: "critical",
    });
  }

  const dimensionDrop = worstDimensionDrop(
    currentPerformance,
    previousPerformance,
    selectedStore
  );

  if (dimensionDrop && dimensionDrop.variation < -10) {
    items.push({
      key: "dimension",
      title: `${dimensionDrop.type}: ${dimensionDrop.label}`,
      value: `↓ ${formatPercentValue(Math.abs(dimensionDrop.variation))}`,
      detail: selectedStore
        ? "Descenso interanual relevante entre vendedores con ventas recientes. No determina su situación laboral."
        : "Mayor descenso de ventas entre tiendas con al menos tres ventas en el año anterior.",
      tone: "critical",
    });
  }

  const regression = summary?.regresion;
  const deviation = regression?.evaluacion?.desviacionPct;
  if (
    regression?.disponible &&
    regression?.evaluacion?.aplicable &&
    Number(regression.r2) >= 0.25 &&
    deviation != null &&
    deviation < -5
  ) {
    items.push({
      key: "regression",
      title: "Cotizaciones y ventas históricas",
      value: `↓ ${formatPercentValue(Math.abs(deviation))}`,
      detail: `Monto observado bajo la relación histórica · R² ${formatDecimal(regression.r2)} · ${regression.observaciones} meses. Señal, no pronóstico.`,
      tone: "warning",
    });
  }

  const pendingChange = variations.pendientesPct;
  const pending = summary?.cotizaciones?.pendientes ?? 0;
  if (pendingChange != null && pendingChange > 10 && pending > 0) {
    items.push({
      key: "pending",
      title: "Ofertas pendientes",
      value: `↑ ${formatPercentValue(pendingChange)}`,
      detail: `${formatInteger(pending)} ofertas sin resolver frente a ${formatInteger(
        summary.comparacion.valoresAnteriores.cotizacionesPendientes
      )} en el año anterior. Revisar antigüedad antes de concluir retrasos.`,
      tone: "warning",
    });
  }

  const measures = [
    {
      key: "closure",
      value: variations.cierreOfPp,
      title: "Tasa de cierre OF",
      unit: " pp",
      description: "Menor proporción de ofertas resueltas terminó en venta.",
      threshold: -2,
    },
    {
      key: "ticket",
      value: variations.ticketPromedioPct,
      title: "Ticket promedio",
      unit: "%",
      description: "Disminuyó el valor promedio de los documentos de venta.",
      threshold: -5,
    },
    {
      key: "sales-count",
      value: variations.ventasPct,
      title: "Cantidad de ventas",
      unit: "%",
      description: "Se emitieron menos documentos de venta válidos que el año pasado.",
      threshold: -5,
    },
  ];

  for (const metric of measures) {
    if (metric.value == null || metric.value >= metric.threshold) continue;
    items.push({
      key: metric.key,
      title: metric.title,
      value: `↓ ${Math.abs(metric.value).toLocaleString("es-CL", {
        maximumFractionDigits: 1,
      })}${metric.unit}`,
      detail: metric.description,
      tone: "warning",
    });
  }

  // Mostrar también hitos favorables cuando existan, sin inventar alertas.
  if (variations.montoVendidoPct != null && variations.montoVendidoPct > 10) {
    items.push({
      key: "sales-growth",
      title: "Crecimiento interanual",
      value: `↑ ${formatPercentValue(variations.montoVendidoPct)}`,
      detail: `Monto vendido ${formatCurrency(currentAmount)} frente a ${formatCurrency(previousAmount)} el año anterior.`,
      tone: "positive",
    });
  }

  if (variations.cierreOfPp != null && variations.cierreOfPp > 2) {
    items.push({
      key: "closure-growth",
      title: "Mejora en el cierre OF",
      value: `↑ ${formatPercentValue(variations.cierreOfPp)} pp`,
      detail: "Mayor proporción de ofertas resueltas terminó en venta.",
      tone: "positive",
    });
  }

  return items.slice(0, 6);
}

function Dashboard() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState("loading");
  const [summary, setSummary] = useState(null);
  const [evolution, setEvolution] = useState({
    actual: [],
    anterior: [],
    granularidad: "day",
  });
  const [performance, setPerformance] = useState({
    current: { tiendas: [], vendedores: [] },
    previous: { tiendas: [], vendedores: [] },
  });
  const [error, setError] = useState("");

  const filters = useMemo(() => {
    const legacyDate = searchParams.get("fecha") || undefined;

    return {
      desde: searchParams.get("desde") || legacyDate,
      hasta: searchParams.get("hasta") || legacyDate,
      tienda: searchParams.get("tienda") || undefined,
    };
  }, [searchParams]);

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      setStatus("loading");
      setError("");

      try {
        const [summaryResponse, evolutionResponse, currentPerformance] =
          await Promise.all([
            getKpiSummary(filters),
            getKpiEvolution(filters),
            getPerformanceAnalytics(filters),
          ]);

        const previousPeriod = summaryResponse?.comparacion?.anterior;

        const previousPerformance =
          previousPeriod?.desde && previousPeriod?.hasta
            ? await getPerformanceAnalytics({
                ...filters,
                desde: previousPeriod.desde,
                hasta: previousPeriod.hasta,
              })
            : { tiendas: [], vendedores: [] };

        if (!active) return;

        setSummary(summaryResponse);
        setEvolution(evolutionResponse);
        setPerformance({
          current: currentPerformance,
          previous: previousPerformance,
        });
        setStatus("success");
      } catch (requestError) {
        if (!active) return;
        setError(requestError.message);
        setStatus("error");
      }
    }

    loadDashboard();

    return () => {
      active = false;
    };
  }, [filters]);

  const variations = summary?.comparacion?.variaciones ?? {};
  const currentPeriod =
    summary?.comparacion?.actual ?? summary?.filtros ?? null;
  const previousPeriod = summary?.comparacion?.anterior ?? null;
  const selectedStore = filters.tienda;

  const focusItems = useMemo(
    () =>
      buildFocusItems({
        summary,
        currentPerformance: performance.current,
        previousPerformance: performance.previous,
        selectedStore,
      }),
    [summary, performance, selectedStore]
  );

  const radarRows = useMemo(() => {
    if (!summary) return [];

    const current = {
      id: "current",
      label: currentPeriod ? formatPeriod(currentPeriod) : "Período actual",
      montoVendido: summary.montos?.vendidoBruto ?? 0,
      ventas: summary.ventas?.total ?? 0,
      cotizaciones: performance.current.tiendas.reduce(
        (sum, row) => sum + Number(row.cotizaciones || 0),
        0
      ),
      conversionPct: summary.conversion?.resueltasPct ?? null,
      ticketPromedio: summary.montos?.ticketPromedioBruto ?? 0,
    };

    const previous = summary.comparacion?.valoresAnteriores;
    if (!previous) return [current];

    return [
      current,
      {
        id: "previous",
        label: previousPeriod ? formatPeriod(previousPeriod) : "Año anterior",
        montoVendido: previous.montoVendidoBruto ?? 0,
        ventas: previous.ventas ?? 0,
        cotizaciones: performance.previous.tiendas.reduce(
          (sum, row) => sum + Number(row.cotizaciones || 0),
          0
        ),
        conversionPct: previous.cierreOfPct ?? null,
        ticketPromedio: previous.ticketPromedioBruto ?? 0,
      },
    ];
  }, [summary, performance.current, performance.previous]);

  return (
    <div className="page executive-dashboard">
      <div className="executive-context">
        <div>
          <span className="panel-eyebrow">Resumen ejecutivo</span>
          <strong>{formatPeriod(currentPeriod)}</strong>
        </div>
        <span>
          {previousPeriod
            ? `Comparado con ${formatPeriod(previousPeriod)}`
            : "Sin período comparable"}
          {selectedStore ? ` · ${selectedStore}` : ""}
        </span>
      </div>

      {status === "error" && (
        <section className="panel executive-error">
          {error}
        </section>
      )}

      <section className="executive-kpi-grid">
        <ExecutiveKpi
          title="Monto vendido"
          value={formatCurrency(summary?.montos?.vendidoBruto)}
          variation={variations.montoVendidoPct}
          unit="%"
          icon={BadgeDollarSign}
        />
        <ExecutiveKpi
          title="Ventas válidas"
          value={formatInteger(summary?.ventas?.total)}
          variation={variations.ventasPct}
          unit="%"
          icon={ReceiptText}
        />
        <ExecutiveKpi
          title="Ticket promedio"
          value={formatCurrency(summary?.montos?.ticketPromedioBruto)}
          variation={variations.ticketPromedioPct}
          unit="%"
          icon={CircleDollarSign}
        />
        <ExecutiveKpi
          title="Cierre OF"
          value={
            summary?.conversion?.resueltasPct == null
              ? "—"
              : formatPercentValue(summary.conversion.resueltasPct)
          }
          variation={variations.cierreOfPp}
          unit=" pp"
          icon={Percent}
        />
      </section>

      <section className="executive-main-grid">
        <article className="panel executive-trend-panel">
          <header className="executive-panel-header">
            <div>
              <span className="panel-eyebrow">Ventas</span>
              <h2>Evolución del monto vendido</h2>
            </div>
            <span className="executive-panel-note">
              Actual vs mismo período del año anterior
            </span>
          </header>

          {status === "loading" ? (
            <div className="executive-chart-empty">
              <span>Cargando evolución comercial...</span>
            </div>
          ) : status === "success" ? (
            <SalesTrendChart
              actual={evolution.actual}
              anterior={evolution.anterior}
              granularity={evolution.granularidad}
            />
          ) : (
            <div className="executive-chart-empty">
              <span>No fue posible cargar la evolución.</span>
            </div>
          )}
        </article>

        <article className="panel executive-focus-panel">
          <header className="executive-panel-header">
            <div>
              <span className="panel-eyebrow">Señales comerciales</span>
              <h2>Focos de atención</h2>
            </div>
          </header>

          {status === "loading" && (
            <div className="executive-focus-empty">
              Analizando variaciones...
            </div>
          )}

          {status === "success" && focusItems.length === 0 && (
            <div className="executive-focus-empty healthy">
              <TrendingUp size={20} />
              <strong>Sin deterioros relevantes</strong>
              <span>
                Sin señales relevantes con los umbrales actuales. Cuando
                falten datos del año anterior, no se infieren variaciones.
              </span>
            </div>
          )}

          {status === "success" && focusItems.length > 0 && (
            <div className="executive-focus-list">
              {focusItems.map((item) => (
                <div
                  className={`executive-focus-item ${item.tone}`}
                  key={item.key}
                >
                  <span className="executive-focus-icon">
                    {item.tone === "critical" ? (
                      <TrendingDown size={18} />
                    ) : item.tone === "positive" ? (
                      <TrendingUp size={18} />
                    ) : (
                      <AlertTriangle size={18} />
                    )}
                  </span>
                  <div className="executive-focus-copy">
                    <div>
                      <strong>{item.title}</strong>
                      <span>{item.value}</span>
                    </div>
                    <p>{item.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {summary?.regresion?.disponible &&
            !focusItems.some((item) => item.key === "regression") && (
              <div className="executive-regression-footnote">
                Regresión mensual activa con {summary.regresion.observaciones} períodos
                históricos · R² {formatDecimal(summary.regresion.r2)}. Se utiliza
                como señal de tendencia, no como causalidad ni pronóstico exacto.
              </div>
            )}
        </article>
      </section>

      <section className="panel radar-module-panel">
        <header className="executive-panel-header">
          <div>
            <span className="panel-eyebrow">Perfil comercial</span>
            <h2>Gráfico de estrellas</h2>
          </div>
          <span className="executive-panel-note">
            Indicadores del período seleccionado
          </span>
        </header>

        {status === "loading" ? (
          <div className="radar-chart-empty">Preparando perfil comercial...</div>
        ) : (
          <RadarChart
            rows={radarRows}
            emptyMessage="Sin actividad comercial para generar el radar."
          />
        )}
      </section>
    </div>
  );
}

export default Dashboard;
