import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  FileText,
  BadgeDollarSign,
  Percent,
  CircleDollarSign,
  ReceiptText,
  BarChart3,
  Database,
  PackageSearch,
  UsersRound,
  ArrowUpRight,
} from "lucide-react";

import KpiCard from "../../components/KpiCard/KpiCard";
import {
  getKpiEvolution,
  getKpiSummary,
  getPerformanceAnalytics,
  getProductAnalytics,
  getSystemHealth,
} from "../../services/api";

const integerFormatter = new Intl.NumberFormat("es-CL", {
  maximumFractionDigits: 0,
});

const currencyFormatter = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
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

function formatPercent(value) {
  return Number.isFinite(Number(value))
    ? `${Number(value).toLocaleString("es-CL", {
        maximumFractionDigits: 2,
      })}%`
    : "—";
}

function formatApiDate(value) {
  if (!value) return null;

  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (!match) return null;

  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}

const evolutionMetrics = {
  cotizaciones: {
    label: "Cotizaciones",
    formatter: formatInteger,
  },
  ventas: {
    label: "Ventas",
    formatter: formatInteger,
  },
  conversion: {
    label: "Conversión",
    formatter: formatPercent,
  },
};

function EvolutionChart({ points, metric }) {
  if (!points?.length) {
    return (
      <div className="evolution-empty">
        <BarChart3 size={22} strokeWidth={1.7} />
        <strong>Sin datos para los filtros seleccionados</strong>
        <span>Prueba otro período o una tienda diferente.</span>
      </div>
    );
  }

  const width = 760;
  const height = 260;
  const padding = {
    top: 24,
    right: 20,
    bottom: 52,
    left: 50,
  };

  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const values = points.map((point) => {
    const value = point[metric];
    return value === null || value === undefined ? null : Number(value);
  });

  const maxValue =
    metric === "conversion"
      ? 100
      : Math.max(1, ...values.map((value) => value ?? 0));

  const slotWidth = chartWidth / points.length;
  const barWidth = Math.min(56, Math.max(8, slotWidth * 0.48));
  const labelEvery = Math.max(1, Math.ceil(points.length / 8));
  const metricConfig = evolutionMetrics[metric];

  function getY(value) {
    return (
      padding.top +
      chartHeight -
      ((value ?? 0) / maxValue) * chartHeight
    );
  }

  return (
    <div className="evolution-chart">
      <svg
        className="evolution-svg"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Evolución de ${metricConfig.label.toLowerCase()}`}
      >
        {Array.from({ length: 5 }).map((_, index) => {
          const ratio = index / 4;
          const y = padding.top + chartHeight * ratio;
          const axisValue = maxValue * (1 - ratio);

          return (
            <g key={`grid-${index}`}>
              <line
                className="evolution-grid-line"
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
              />
              <text
                className="evolution-axis-label"
                x={padding.left - 9}
                y={y + 3}
                textAnchor="end"
              >
                {metric === "conversion"
                  ? `${Math.round(axisValue)}%`
                  : formatInteger(Math.round(axisValue))}
              </text>
            </g>
          );
        })}

        {points.map((point, index) => {
          const rawValue = values[index];
          const value = rawValue ?? 0;
          const x =
            padding.left +
            index * slotWidth +
            (slotWidth - barWidth) / 2;
          const y = getY(value);
          const barHeight =
            padding.top + chartHeight - y;
          const showDate =
            index % labelEvery === 0 ||
            index === points.length - 1;

          return (
            <g key={`${point.fecha}-${metric}`}>
              <rect
                className="evolution-bar"
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(barHeight, value > 0 ? 2 : 0)}
                rx="5"
              >
                <title>
                  {`${formatApiDate(point.fecha)} · ${metricConfig.label}: ${metricConfig.formatter(rawValue)}`}
                </title>
              </rect>

              {points.length <= 10 && (
                <text
                  className="evolution-value-label"
                  x={x + barWidth / 2}
                  y={Math.max(14, y - 7)}
                  textAnchor="middle"
                >
                  {metricConfig.formatter(rawValue)}
                </text>
              )}

              {showDate && (
                <text
                  className="evolution-date-label"
                  x={x + barWidth / 2}
                  y={height - 21}
                  textAnchor="middle"
                >
                  {formatApiDate(point.fecha)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function Dashboard() {
  const [searchParams] = useSearchParams();
  const [systemStatus, setSystemStatus] = useState("checking");
  const [kpiStatus, setKpiStatus] = useState("loading");
  const [kpiData, setKpiData] = useState(null);
  const [kpiError, setKpiError] = useState("");

  const [evolutionStatus, setEvolutionStatus] = useState("loading");
  const [evolutionData, setEvolutionData] = useState([]);
  const [evolutionError, setEvolutionError] = useState("");
  const [evolutionMetric, setEvolutionMetric] = useState("cotizaciones");

  const [analyticsStatus, setAnalyticsStatus] = useState("loading");
  const [productData, setProductData] = useState({ resumen: {}, productos: [] });
  const [performanceData, setPerformanceData] = useState({
    tiendas: [],
    vendedores: [],
  });
  const [analyticsError, setAnalyticsError] = useState("");

  const selectedDate = searchParams.get("fecha") ?? "";
  const selectedStore = searchParams.get("tienda") ?? "";

  useEffect(() => {
    let active = true;

    getSystemHealth()
      .then(() => {
        if (active) setSystemStatus("online");
      })
      .catch(() => {
        if (active) setSystemStatus("offline");
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    setKpiStatus("loading");
    setKpiError("");

    getKpiSummary({
      desde: selectedDate || undefined,
      hasta: selectedDate || undefined,
      tienda: selectedStore || undefined,
    })
      .then((data) => {
        if (!active) return;

        setKpiData(data);
        setKpiStatus("success");
      })
      .catch((error) => {
        if (!active) return;

        setKpiError(error.message);
        setKpiStatus("error");
      });

    return () => {
      active = false;
    };
  }, [selectedDate, selectedStore]);

  useEffect(() => {
    let active = true;

    setEvolutionStatus("loading");
    setEvolutionError("");

    getKpiEvolution({
      desde: selectedDate || undefined,
      hasta: selectedDate || undefined,
      tienda: selectedStore || undefined,
    })
      .then((data) => {
        if (!active) return;

        setEvolutionData(data.puntos ?? []);
        setEvolutionStatus("success");
      })
      .catch((error) => {
        if (!active) return;

        setEvolutionData([]);
        setEvolutionError(error.message);
        setEvolutionStatus("error");
      });

    return () => {
      active = false;
    };
  }, [selectedDate, selectedStore]);


  useEffect(() => {
    let active = true;
    setAnalyticsStatus("loading");
    setAnalyticsError("");

    const filters = {
      desde: selectedDate || undefined,
      hasta: selectedDate || undefined,
      tienda: selectedStore || undefined,
    };

    Promise.all([
      getProductAnalytics(filters),
      getPerformanceAnalytics(filters),
    ])
      .then(([products, performance]) => {
        if (!active) return;

        setProductData(products);
        setPerformanceData(performance);
        setAnalyticsStatus("success");
      })
      .catch((error) => {
        if (!active) return;

        setAnalyticsError(error.message);
        setAnalyticsStatus("error");
      });

    return () => {
      active = false;
    };
  }, [selectedDate, selectedStore]);

  const databaseOnline = systemStatus === "online";

  const periodLabel = useMemo(() => {
    const from = formatApiDate(kpiData?.periodoDisponible?.desde);
    const to = formatApiDate(kpiData?.periodoDisponible?.hasta);

    if (!from || !to) return null;

    return from === to ? from : `${from} al ${to}`;
  }, [kpiData]);

  const kpis = useMemo(() => {
    const loading = kpiStatus === "loading";
    const data = kpiData;

    return [
      {
        title: "Cotizaciones",
        icon: FileText,
        value: loading ? "…" : formatInteger(data?.cotizaciones?.total),
        caption:
          kpiStatus === "success"
            ? `${formatInteger(data?.cotizaciones?.validas)} válidas · ${formatInteger(data?.cotizaciones?.pendientes)} pendientes`
            : "Ofertas comerciales registradas",
      },
      {
        title: "Ventas",
        icon: BadgeDollarSign,
        value: loading ? "…" : formatInteger(data?.ventas?.total),
        caption:
          kpiStatus === "success"
            ? `FR ${formatInteger(data?.ventas?.fr)} · FD ${formatInteger(data?.ventas?.fd)}`
            : "Documentos de venta válidos",
      },
      {
        title: "Conversión",
        icon: Percent,
        value: loading
          ? "…"
          : formatPercent(data?.conversion?.resueltasPct),
        caption:
          kpiStatus === "success"
            ? `${formatInteger(data?.cotizaciones?.conVenta)} de ${formatInteger(data?.cotizaciones?.resueltas)} OF resueltas`
            : "Conversión de ofertas resueltas",
      },
      {
        title: "Monto cotizado",
        icon: CircleDollarSign,
        value: loading
          ? "…"
          : formatCurrency(data?.montos?.cotizadoBruto),
        caption: "Monto bruto de cotizaciones válidas",
      },
      {
        title: "Ticket promedio",
        icon: ReceiptText,
        value: loading
          ? "…"
          : formatCurrency(data?.montos?.ticketPromedioBruto),
        caption: "Promedio bruto por documento de venta",
      },
    ];
  }, [kpiData, kpiStatus]);

  const dashboardQuery = searchParams.toString();
  const productsLink = dashboardQuery
    ? `/productos?${dashboardQuery}`
    : "/productos";
  const performanceLink = dashboardQuery
    ? `/tiendas?${dashboardQuery}`
    : "/tiendas";

  const metricTotals = {
    cotizaciones: formatInteger(kpiData?.cotizaciones?.total),
    ventas: formatInteger(kpiData?.ventas?.total),
    conversion: formatPercent(kpiData?.conversion?.resueltasPct),
  };

  return (
    <div className="page dashboard-page">
      <section className="kpi-grid" aria-label="Indicadores principales">
        {kpis.map((kpi) => (
          <KpiCard
            key={kpi.title}
            title={kpi.title}
            value={kpi.value}
            icon={kpi.icon}
            caption={kpi.caption}
          />
        ))}
      </section>

      <section className="dashboard-primary-grid">
        <article className="panel analytics-panel">
          <header className="panel-header">
            <div>
              <span className="panel-eyebrow">Visión general</span>
              <h2>Evolución comercial</h2>
            </div>

            <div className="metric-tags" aria-label="Métricas disponibles">
              {Object.entries(evolutionMetrics).map(([key, config]) => (
                <button
                  type="button"
                  className={`metric-tag ${evolutionMetric === key ? "active" : ""}`}
                  key={key}
                  onClick={() => setEvolutionMetric(key)}
                >
                  {config.label} {metricTotals[key]}
                </button>
              ))}
            </div>
          </header>

          <div className="evolution-visual">
            {evolutionStatus === "success" ? (
              <EvolutionChart
                points={evolutionData}
                metric={evolutionMetric}
              />
            ) : (
              <div className="evolution-empty">
                <BarChart3 size={22} strokeWidth={1.7} />
                <strong>
                  {evolutionStatus === "error"
                    ? "No fue posible cargar la evolución"
                    : "Cargando evolución comercial"}
                </strong>
                <span>
                  {evolutionStatus === "error"
                    ? evolutionError
                    : "Micapp está consultando la serie temporal en PostgreSQL."}
                </span>
              </div>
            )}
          </div>

          <div className="evolution-footnote">
            <span>
              Período analizado: {periodLabel ?? "sin registros"}
            </span>
            <span>
              {selectedStore ? `Tienda: ${selectedStore}` : "Todas las tiendas"}
            </span>
          </div>
        </article>

        <article className="panel data-status-panel">
          <header className="panel-header">
            <div>
              <span className="panel-eyebrow">Estado</span>
              <h2>Información del sistema</h2>
            </div>

            <span
              className={`status-badge ${databaseOnline ? "online" : ""}`}
            >
              <span className="status-dot" />
              {systemStatus === "checking"
                ? "Comprobando"
                : databaseOnline
                  ? "BD conectada"
                  : "Sin conexión"}
            </span>
          </header>

          <div className="data-status-content">
            <div className="data-status-icon">
              <Database size={25} strokeWidth={1.6} />
            </div>

            <div>
              <h3>
                {databaseOnline
                  ? kpiStatus === "success"
                    ? "Información comercial disponible"
                    : "PostgreSQL está disponible"
                  : "Base de datos no disponible"}
              </h3>

              <p>
                {!databaseOnline
                  ? "Inicia el backend y PostgreSQL para habilitar la capa de datos de Micapp."
                  : kpiStatus === "success"
                    ? `Micapp está trabajando con información procesada del ${periodLabel ?? "período seleccionado"}. Se registran ${formatInteger(kpiData?.ventas?.total)} documentos de venta válidos y ${formatInteger(kpiData?.cotizaciones?.total)} cotizaciones${selectedStore ? ` para ${selectedStore}` : ""}.`
                    : kpiStatus === "error"
                      ? `La base de datos está conectada, pero los KPI no pudieron cargarse: ${kpiError}`
                      : "Micapp está conectado al backend y consultando los indicadores comerciales."}
              </p>
            </div>
          </div>

          <Link className="dashboard-action" to="/importacion">
            Importar datos
            <ArrowUpRight size={15} />
          </Link>
        </article>
      </section>

      <section className="dashboard-secondary-grid">
        <article className="panel compact-analysis-panel">
          <header className="panel-header">
            <div className="panel-title-with-icon">
              <PackageSearch size={17} strokeWidth={1.8} />
              <div>
                <span className="panel-eyebrow">Análisis</span>
                <h2>Productos y demanda</h2>
              </div>
            </div>

            <Link className="panel-link" to={productsLink}>
              Ver módulo
              <ArrowUpRight size={13} />
            </Link>
          </header>

          {analyticsStatus === "loading" && (
            <div className="compact-empty-state">
              <span>Analizando productos...</span>
            </div>
          )}

          {analyticsStatus === "error" && (
            <div className="compact-empty-state">
              <span>{analyticsError}</span>
            </div>
          )}

          {analyticsStatus === "success" && (
            <div className="dashboard-analysis-content">
              <div className="mini-metrics">
                <div>
                  <span>Unidades cotizadas</span>
                  <strong>
                    {formatInteger(productData.resumen?.unidadesCotizadas)}
                  </strong>
                </div>
                <div>
                  <span>No convertidas</span>
                  <strong>
                    {formatInteger(productData.resumen?.demandaNoConvertida)}
                  </strong>
                </div>
                <div>
                  <span>Conversión</span>
                  <strong>
                    {formatPercent(productData.resumen?.conversionUnidadesPct)}
                  </strong>
                </div>
              </div>

              <div className="ranking-list">
                {(productData.productos ?? []).slice(0, 5).map((product) => (
                  <div className="ranking-row" key={product.codigo}>
                    <div className="ranking-main">
                      <strong>{product.descripcion}</strong>
                      <span>{product.codigo}</span>
                    </div>
                    <div className="ranking-values">
                      <span>
                        {formatInteger(product.unidadesCotizadas)} cot.
                      </span>
                      <strong>
                        {formatInteger(product.demandaNoConvertida)} sin conv.
                      </strong>
                    </div>
                  </div>
                ))}

                {(productData.productos ?? []).length === 0 && (
                  <div className="ranking-empty">
                    Sin productos para los filtros seleccionados.
                  </div>
                )}
              </div>
            </div>
          )}
        </article>

        <article className="panel compact-analysis-panel">
          <header className="panel-header">
            <div className="panel-title-with-icon">
              <UsersRound size={17} strokeWidth={1.8} />
              <div>
                <span className="panel-eyebrow">Rendimiento</span>
                <h2>Tiendas y vendedores</h2>
              </div>
            </div>

            <Link className="panel-link" to={performanceLink}>
              Ver módulo
              <ArrowUpRight size={13} />
            </Link>
          </header>

          {analyticsStatus === "loading" && (
            <div className="compact-empty-state">
              <span>Analizando rendimiento...</span>
            </div>
          )}

          {analyticsStatus === "error" && (
            <div className="compact-empty-state">
              <span>{analyticsError}</span>
            </div>
          )}

          {analyticsStatus === "success" && (
            <div className="dashboard-performance-content">
              <div className="performance-column">
                <span className="performance-title">Tiendas</span>
                {(performanceData.tiendas ?? []).slice(0, 4).map((store) => (
                  <div className="performance-row" key={store.tienda}>
                    <div>
                      <strong>{store.tienda}</strong>
                      <span>{store.ventas} ventas</span>
                    </div>
                    <strong>{formatPercent(store.conversionPct)}</strong>
                  </div>
                ))}
              </div>

              <div className="performance-column">
                <span className="performance-title">Vendedores</span>
                {(performanceData.vendedores ?? []).slice(0, 4).map((seller) => (
                  <div
                    className="performance-row"
                    key={`${seller.tienda}-${seller.vendedor}`}
                  >
                    <div>
                      <strong>{seller.vendedor}</strong>
                      <span>{seller.tienda ?? "Sin tienda"}</span>
                    </div>
                    <strong>{formatCurrency(seller.montoVendido)}</strong>
                  </div>
                ))}
              </div>

              {(performanceData.tiendas ?? []).length === 0 &&
                (performanceData.vendedores ?? []).length === 0 && (
                  <div className="ranking-empty">
                    Sin datos de rendimiento para los filtros seleccionados.
                  </div>
                )}
            </div>
          )}
        </article>
      </section>
    </div>
  );
}

export default Dashboard;
