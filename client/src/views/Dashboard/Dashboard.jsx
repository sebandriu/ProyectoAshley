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

function buildLinePath(values, getX, getY) {
  let path = "";
  let drawing = false;

  values.forEach((value, index) => {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) {
      drawing = false;
      return;
    }

    const command = drawing ? "L" : "M";
    path += `${command}${getX(index)},${getY(Number(value))} `;
    drawing = true;
  });

  return path.trim();
}

function CommercialTrendChart({ points }) {
  if (!points?.length) {
    return (
      <div className="evolution-empty">
        <BarChart3 size={22} strokeWidth={1.7} />
        <strong>Sin datos para los filtros seleccionados</strong>
        <span>Prueba otro período o una tienda diferente.</span>
      </div>
    );
  }

  const width = 920;
  const height = 310;
  const padding = {
    top: 24,
    right: 56,
    bottom: 48,
    left: 54,
  };

  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const maxDocuments = Math.max(
    1,
    ...points.map((point) =>
      Math.max(
        Number(point.cotizaciones || 0),
        Number(point.ventas || 0)
      )
    )
  );

  const getX = (index) =>
    points.length === 1
      ? padding.left + chartWidth / 2
      : padding.left + (index / (points.length - 1)) * chartWidth;

  const getDocumentY = (value) =>
    padding.top +
    chartHeight -
    (Number(value || 0) / maxDocuments) * chartHeight;

  const getClosureY = (value) =>
    padding.top +
    chartHeight -
    (Math.max(0, Math.min(100, Number(value || 0))) / 100) * chartHeight;

  const quotePath = buildLinePath(
    points.map((point) => Number(point.cotizaciones || 0)),
    getX,
    getDocumentY
  );

  const salesPath = buildLinePath(
    points.map((point) => Number(point.ventas || 0)),
    getX,
    getDocumentY
  );

  const closurePath = buildLinePath(
    points.map((point) =>
      point.conversion === null || point.conversion === undefined
        ? null
        : Number(point.conversion)
    ),
    getX,
    getClosureY
  );

  const labelIndexes = new Set(
    Array.from({ length: Math.min(6, points.length) }, (_, index) =>
      Math.round(
        (index / Math.max(1, Math.min(6, points.length) - 1)) *
          (points.length - 1)
      )
    )
  );

  return (
    <div className="advanced-trend-chart">
      <div className="chart-legend">
        <span><i className="legend-swatch quotes" />OF</span>
        <span><i className="legend-swatch sales" />Ventas FR/FD</span>
        <span><i className="legend-swatch closure" />Cierre OF</span>
      </div>

      <svg
        className="advanced-trend-svg"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Evolución de ofertas, ventas y cierre de ofertas"
      >
        {Array.from({ length: 5 }).map((_, index) => {
          const ratio = index / 4;
          const y = padding.top + chartHeight * ratio;
          const documentValue = maxDocuments * (1 - ratio);
          const closureValue = 100 * (1 - ratio);

          return (
            <g key={`grid-${index}`}>
              <line
                className="advanced-chart-grid"
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
              />
              <text
                className="advanced-chart-axis"
                x={padding.left - 10}
                y={y + 3}
                textAnchor="end"
              >
                {formatInteger(Math.round(documentValue))}
              </text>
              <text
                className="advanced-chart-axis closure-axis"
                x={width - padding.right + 10}
                y={y + 3}
                textAnchor="start"
              >
                {Math.round(closureValue)}%
              </text>
            </g>
          );
        })}

        <path className="trend-line quotes" d={quotePath} />
        <path className="trend-line sales" d={salesPath} />
        <path className="trend-line closure" d={closurePath} />

        {points.map((point, index) => {
          if (!labelIndexes.has(index)) return null;

          return (
            <text
              className="advanced-chart-date"
              key={`date-${point.fecha}-${index}`}
              x={getX(index)}
              y={height - 18}
              textAnchor="middle"
            >
              {formatApiDate(point.fecha)}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

function QuoteStatusChart({ data }) {
  const statuses = [
    {
      key: "complete",
      label: "Convertidas completas",
      value: Number(data?.convertidasCompletas || 0),
    },
    {
      key: "partial",
      label: "Conversión parcial",
      value: Number(data?.conversionesParciales || 0),
    },
    {
      key: "no-sale",
      label: "Cerradas sin venta",
      value: Number(data?.cerradasSinVenta || 0),
    },
    {
      key: "pending",
      label: "Pendientes",
      value: Number(data?.pendientes || 0),
    },
    {
      key: "cancelled",
      label: "Canceladas",
      value: Number(data?.canceladas || 0),
    },
  ];

  const total = statuses.reduce((sum, status) => sum + status.value, 0);

  if (total <= 0) {
    return <div className="compact-empty-state"><span>Sin OF para este período.</span></div>;
  }

  return (
    <div className="quote-status-chart">
      <div className="quote-status-stack" aria-label="Distribución de estados de OF">
        {statuses.map((status) => (
          <div
            key={status.key}
            className={`quote-status-segment ${status.key}`}
            style={{ width: `${(status.value / total) * 100}%` }}
            title={`${status.label}: ${formatInteger(status.value)}`}
          />
        ))}
      </div>

      <div className="quote-status-legend">
        {statuses.map((status) => (
          <div className="quote-status-item" key={status.key}>
            <span className={`status-dot-chart ${status.key}`} />
            <div>
              <span>{status.label}</span>
              <strong>{formatInteger(status.value)}</strong>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SalesMixChart({ fr, fd }) {
  const frValue = Number(fr || 0);
  const fdValue = Number(fd || 0);
  const total = frValue + fdValue;

  if (total <= 0) {
    return <div className="compact-empty-state"><span>Sin ventas para este período.</span></div>;
  }

  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const frLength = (frValue / total) * circumference;
  const fdLength = circumference - frLength;

  return (
    <div className="sales-mix-chart">
      <svg viewBox="0 0 150 150" className="sales-mix-donut" role="img" aria-label="Composición de ventas FR y FD">
        <circle className="donut-track" cx="75" cy="75" r={radius} />
        <circle
          className="donut-segment fr"
          cx="75"
          cy="75"
          r={radius}
          strokeDasharray={`${frLength} ${circumference - frLength}`}
        />
        <circle
          className="donut-segment fd"
          cx="75"
          cy="75"
          r={radius}
          strokeDasharray={`${fdLength} ${circumference - fdLength}`}
          strokeDashoffset={-frLength}
        />
        <text className="donut-total" x="75" y="71" textAnchor="middle">
          {formatInteger(total)}
        </text>
        <text className="donut-caption" x="75" y="88" textAnchor="middle">
          ventas
        </text>
      </svg>

      <div className="sales-mix-legend">
        <div>
          <span><i className="legend-swatch fr" />FR</span>
          <strong>{formatInteger(frValue)}</strong>
          <small>{formatPercent((frValue / total) * 100)}</small>
        </div>
        <div>
          <span><i className="legend-swatch fd" />FD</span>
          <strong>{formatInteger(fdValue)}</strong>
          <small>{formatPercent((fdValue / total) * 100)}</small>
        </div>
      </div>
    </div>
  );
}

function StoreRankingChart({ stores }) {
  const rows = (stores ?? []).slice(0, 7);
  const maxAmount = Math.max(
    1,
    ...rows.map((store) => Number(store.montoVendido || 0))
  );

  if (!rows.length) {
    return <div className="compact-empty-state"><span>Sin tiendas para estos filtros.</span></div>;
  }

  return (
    <div className="store-ranking-chart">
      {rows.map((store) => {
        const amount = Number(store.montoVendido || 0);
        const width = Math.max(2, (amount / maxAmount) * 100);

        return (
          <div className="store-ranking-item" key={store.tienda}>
            <div className="store-ranking-heading">
              <strong>{store.tienda}</strong>
              <span>{formatCurrency(amount)}</span>
            </div>
            <div className="store-ranking-track">
              <div
                className="store-ranking-fill"
                style={{ width: `${width}%` }}
              />
            </div>
            <div className="store-ranking-meta">
              <span>{formatInteger(store.ventas)} ventas</span>
              <span>Cierre OF {formatPercent(store.conversionPct)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ProductOpportunityChart({ products }) {
  const rows = [...(products ?? [])]
    .filter((product) => Number(product.unidadesCotizadas || 0) > 0)
    .sort(
      (a, b) =>
        Number(b.demandaNoConvertida || 0) -
        Number(a.demandaNoConvertida || 0)
    )
    .slice(0, 30);

  if (!rows.length) {
    return <div className="compact-empty-state"><span>Sin productos suficientes para el gráfico.</span></div>;
  }

  const width = 760;
  const height = 300;
  const padding = { top: 20, right: 24, bottom: 48, left: 54 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const maxQuoted = Math.max(
    1,
    ...rows.map((product) => Number(product.unidadesCotizadas || 0))
  );
  const maxOpportunity = Math.max(
    1,
    ...rows.map((product) => Number(product.demandaNoConvertida || 0))
  );
  const maxSoldAmount = Math.max(
    1,
    ...rows.map((product) => Number(product.montoVendido || 0))
  );

  const getX = (value) =>
    padding.left + (Number(value || 0) / maxQuoted) * chartWidth;
  const getY = (value) =>
    padding.top +
    chartHeight -
    (Number(value || 0) / maxOpportunity) * chartHeight;

  return (
    <div className="product-opportunity-chart">
      <svg viewBox={`0 0 ${width} ${height}`} className="product-opportunity-svg">
        {Array.from({ length: 5 }).map((_, index) => {
          const ratio = index / 4;
          const y = padding.top + chartHeight * ratio;

          return (
            <line
              key={`grid-${index}`}
              className="advanced-chart-grid"
              x1={padding.left}
              y1={y}
              x2={width - padding.right}
              y2={y}
            />
          );
        })}

        <line className="opportunity-axis-line" x1={padding.left} y1={padding.top} x2={padding.left} y2={padding.top + chartHeight} />
        <line className="opportunity-axis-line" x1={padding.left} y1={padding.top + chartHeight} x2={width - padding.right} y2={padding.top + chartHeight} />

        <text className="opportunity-axis-title" x={padding.left + chartWidth / 2} y={height - 10} textAnchor="middle">
          Unidades cotizadas
        </text>
        <text
          className="opportunity-axis-title"
          x="15"
          y={padding.top + chartHeight / 2}
          textAnchor="middle"
          transform={`rotate(-90 15 ${padding.top + chartHeight / 2})`}
        >
          Demanda no convertida
        </text>

        {rows.map((product, index) => {
          const x = getX(product.unidadesCotizadas);
          const y = getY(product.demandaNoConvertida);
          const radius =
            4 +
            Math.sqrt(Number(product.montoVendido || 0) / maxSoldAmount) * 10;

          return (
            <g key={product.codigo}>
              <circle
                className="opportunity-bubble"
                cx={x}
                cy={y}
                r={radius}
              >
                <title>
                  {`${product.codigo} · ${product.descripcion} · Cotizadas: ${formatInteger(product.unidadesCotizadas)} · No convertidas: ${formatInteger(product.demandaNoConvertida)} · Vendidas: ${formatInteger(product.unidadesVendidas)} · Monto: ${formatCurrency(product.montoVendido)}`}
                </title>
              </circle>

              {index < 6 && (
                <text
                  className="opportunity-product-label"
                  x={x + radius + 4}
                  y={y - radius - 2}
                >
                  {product.codigo}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <div className="chart-help-text">
        Más arriba = mayor demanda cotizada aún no convertida. El tamaño del punto
        aumenta con el monto vendido del producto.
      </div>
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

  const [analyticsStatus, setAnalyticsStatus] = useState("loading");
  const [productData, setProductData] = useState({ resumen: {}, productos: [] });
  const [performanceData, setPerformanceData] = useState({
    tiendas: [],
    vendedores: [],
  });
  const [analyticsError, setAnalyticsError] = useState("");

  const legacyDate = searchParams.get("fecha") ?? "";
  const selectedFrom = searchParams.get("desde") ?? legacyDate;
  const selectedTo = searchParams.get("hasta") ?? legacyDate;
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
      desde: selectedFrom || undefined,
      hasta: selectedTo || undefined,
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
  }, [selectedFrom, selectedTo, selectedStore]);

  useEffect(() => {
    let active = true;

    setEvolutionStatus("loading");
    setEvolutionError("");

    getKpiEvolution({
      desde: selectedFrom || undefined,
      hasta: selectedTo || undefined,
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
  }, [selectedFrom, selectedTo, selectedStore]);

  useEffect(() => {
    let active = true;
    setAnalyticsStatus("loading");
    setAnalyticsError("");

    const filters = {
      desde: selectedFrom || undefined,
      hasta: selectedTo || undefined,
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
  }, [selectedFrom, selectedTo, selectedStore]);

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
        title: "Cierre OF",
        icon: Percent,
        value: loading
          ? "…"
          : formatPercent(data?.conversion?.resueltasPct),
        caption:
          kpiStatus === "success"
            ? `${formatInteger(data?.cotizaciones?.conVenta)} de ${formatInteger(data?.cotizaciones?.resueltas)} OF resueltas con venta`
            : "OF resueltas que generaron venta",
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

      <div className="dashboard-definition-note">
        <strong>Cierre OF</strong> mide el porcentaje de ofertas resueltas que
        generaron una venta completa o parcial. No corresponde a la conversión
        oficial de tráfico de tienda, ya que Micapp no dispone del contador de
        visitantes.
      </div>

      <section className="dashboard-primary-grid">
        <article className="panel analytics-panel">
          <header className="panel-header">
            <div>
              <span className="panel-eyebrow">Visión general</span>
              <h2>Evolución comercial combinada</h2>
            </div>
            <span className="module-count">
              {evolutionData.length} puntos temporales
            </span>
          </header>

          <div className="evolution-visual advanced">
            {evolutionStatus === "success" ? (
              <CommercialTrendChart points={evolutionData} />
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
            <span>Período analizado: {periodLabel ?? "sin registros"}</span>
            <span>{selectedStore ? `Tienda: ${selectedStore}` : "Todas las tiendas"}</span>
          </div>
        </article>

        <article className="panel data-status-panel">
          <header className="panel-header">
            <div>
              <span className="panel-eyebrow">Estado</span>
              <h2>Información del sistema</h2>
            </div>

            <span className={`status-badge ${databaseOnline ? "online" : ""}`}>
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

      <section className="dashboard-insight-grid">
        <article className="panel dashboard-chart-panel">
          <header className="panel-header">
            <div>
              <span className="panel-eyebrow">Embudo comercial</span>
              <h2>Estado de las OF</h2>
            </div>
          </header>
          {kpiStatus === "success" ? (
            <QuoteStatusChart data={kpiData?.cotizaciones} />
          ) : (
            <div className="compact-empty-state">
              <span>{kpiStatus === "error" ? kpiError : "Cargando estados de OF..."}</span>
            </div>
          )}
        </article>

        <article className="panel dashboard-chart-panel">
          <header className="panel-header">
            <div>
              <span className="panel-eyebrow">Composición</span>
              <h2>Ventas FR vs FD</h2>
            </div>
          </header>
          {kpiStatus === "success" ? (
            <SalesMixChart fr={kpiData?.ventas?.fr} fd={kpiData?.ventas?.fd} />
          ) : (
            <div className="compact-empty-state">
              <span>{kpiStatus === "error" ? kpiError : "Cargando composición de ventas..."}</span>
            </div>
          )}
        </article>
      </section>

      <section className="dashboard-insight-grid wide-left">
        <article className="panel dashboard-chart-panel">
          <header className="panel-header">
            <div className="panel-title-with-icon">
              <PackageSearch size={17} strokeWidth={1.8} />
              <div>
                <span className="panel-eyebrow">Oportunidad comercial</span>
                <h2>Cotización vs demanda no convertida</h2>
              </div>
            </div>
            <Link className="panel-link" to={productsLink}>
              Ver productos
              <ArrowUpRight size={13} />
            </Link>
          </header>

          {analyticsStatus === "success" ? (
            <ProductOpportunityChart products={productData.productos} />
          ) : (
            <div className="compact-empty-state">
              <span>{analyticsStatus === "error" ? analyticsError : "Analizando productos..."}</span>
            </div>
          )}
        </article>

        <article className="panel dashboard-chart-panel">
          <header className="panel-header">
            <div className="panel-title-with-icon">
              <UsersRound size={17} strokeWidth={1.8} />
              <div>
                <span className="panel-eyebrow">Rendimiento</span>
                <h2>Tiendas por monto vendido</h2>
              </div>
            </div>
            <Link className="panel-link" to={performanceLink}>
              Ver módulo
              <ArrowUpRight size={13} />
            </Link>
          </header>

          {analyticsStatus === "success" ? (
            <StoreRankingChart stores={performanceData.tiendas} />
          ) : (
            <div className="compact-empty-state">
              <span>{analyticsStatus === "error" ? analyticsError : "Analizando tiendas..."}</span>
            </div>
          )}
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
                  <strong>{formatInteger(productData.resumen?.unidadesCotizadas)}</strong>
                </div>
                <div>
                  <span>No convertidas</span>
                  <strong>{formatInteger(productData.resumen?.demandaNoConvertida)}</strong>
                </div>
                <div>
                  <span>Conv. unidades OF</span>
                  <strong>{formatPercent(productData.resumen?.conversionUnidadesPct)}</strong>
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
                      <span>{formatInteger(product.unidadesCotizadas)} cot.</span>
                      <strong>{formatInteger(product.demandaNoConvertida)} sin conv.</strong>
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
