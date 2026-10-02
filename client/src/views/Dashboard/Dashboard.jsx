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
      text: `↓ ${absolute}${unit} vs período anterior`,
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
    text: `Sin variación vs período anterior`,
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
          <span><i className="executive-legend-line previous" />Período anterior</span>
        )}
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="executive-sales-svg"
        role="img"
        aria-label="Evolución del monto vendido comparada con el período anterior"
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

    if (previousAmount <= 0) return;

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

  if (Number(variations.montoVendidoPct) < 0) {
    items.push({
      key: "sales-amount",
      title: "Monto vendido",
      value: `↓ ${formatPercentValue(
        Math.abs(Number(variations.montoVendidoPct))
      )}`,
      detail: "El monto vendido cayó respecto al período comparable anterior.",
      tone: "critical",
    });
  }

  const dimensionDrop = worstDimensionDrop(
    currentPerformance,
    previousPerformance,
    selectedStore
  );

  if (dimensionDrop) {
    items.push({
      key: "dimension",
      title: `${dimensionDrop.type}: ${dimensionDrop.label}`,
      value: `↓ ${formatPercentValue(
        Math.abs(dimensionDrop.variation)
      )}`,
      detail: "Es la mayor caída de monto vendido dentro del nivel analizado.",
      tone: "critical",
    });
  }

  const regression = summary?.regresion;
  const regressionDeviation =
    regression?.evaluacion?.desviacionPct;

  if (
    regression?.disponible &&
    regression?.evaluacion?.aplicable &&
    Number(regression?.r2) >= 0.25 &&
    Number(regressionDeviation) < -5
  ) {
    items.push({
      key: "regression",
      title: "Relación histórica cotización → venta",
      value: `↓ ${formatPercentValue(
        Math.abs(Number(regressionDeviation))
      )}`,
      detail: `Venta bajo la tendencia histórica para el monto cotizado · R² ${formatDecimal(
        regression.r2
      )} · ${regression.observaciones} meses.`,
      tone: "warning",
    });
  }

  const secondary = [
    {
      key: "closure",
      value: variations.cierreOfPp,
      title: "Cierre OF",
      unit: " pp",
      detail: "Menor proporción de OF resueltas terminó en venta.",
    },
    {
      key: "ticket",
      value: variations.ticketPromedioPct,
      title: "Ticket promedio",
      unit: "%",
      detail: "El valor promedio por documento de venta disminuyó.",
    },
    {
      key: "sales-count",
      value: variations.ventasPct,
      title: "Ventas válidas",
      unit: "%",
      detail: "Se registraron menos documentos de venta válidos.",
    },
  ]
    .filter((item) => Number(item.value) < 0)
    .sort((a, b) => Number(a.value) - Number(b.value));

  for (const item of secondary) {
    if (items.length >= 3) break;

    items.push({
      key: item.key,
      title: item.title,
      value: `↓ ${Math.abs(Number(item.value)).toLocaleString("es-CL", {
        maximumFractionDigits: 1,
      })}${item.unit}`,
      detail: item.detail,
      tone: "warning",
    });
  }

  return items.slice(0, 3);
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
              Actual vs período anterior
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
              <span className="panel-eyebrow">Excepciones</span>
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
                Los indicadores principales no muestran caídas frente al
                período comparable.
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
    </div>
  );
}

export default Dashboard;
