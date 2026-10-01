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
import { getKpiSummary, getSystemHealth } from "../../services/api";

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

function Dashboard() {
  const [searchParams] = useSearchParams();
  const [systemStatus, setSystemStatus] = useState("checking");
  const [kpiStatus, setKpiStatus] = useState("loading");
  const [kpiData, setKpiData] = useState(null);
  const [kpiError, setKpiError] = useState("");

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
              <span className="metric-tag active">
                Cotizaciones {formatInteger(kpiData?.cotizaciones?.total)}
              </span>
              <span className="metric-tag">
                Ventas {formatInteger(kpiData?.ventas?.total)}
              </span>
              <span className="metric-tag">
                Conversión {formatPercent(kpiData?.conversion?.resueltasPct)}
              </span>
            </div>
          </header>

          <div className="visual-placeholder">
            <div className="visual-placeholder-content">
              <div className="visual-placeholder-icon">
                <BarChart3 size={22} strokeWidth={1.7} />
              </div>

              <strong>
                {kpiStatus === "success"
                  ? "Datos comerciales procesados"
                  : kpiStatus === "error"
                    ? "No fue posible cargar los indicadores"
                    : "Cargando información comercial"}
              </strong>

              <span>
                {kpiStatus === "success"
                  ? `Período analizado: ${periodLabel ?? "sin registros para los filtros seleccionados"}. Hay ${formatInteger(kpiData?.cotizaciones?.convertidasCompletas)} OF convertidas completas, ${formatInteger(kpiData?.cotizaciones?.conversionesParciales)} parciales y ${formatInteger(kpiData?.cotizaciones?.pendientes)} pendientes. El gráfico temporal se incorporará en el siguiente incremento.`
                  : kpiStatus === "error"
                    ? kpiError
                    : "Micapp está consultando los datos procesados en PostgreSQL."}
              </span>
            </div>
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
          </header>

          <div className="compact-empty-state">
            <span>
              Aquí se visualizarán productos cotizados, ventas y demanda no
              convertida.
            </span>
          </div>
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
          </header>

          <div className="compact-empty-state">
            <span>
              Aquí se mostrarán comparaciones comerciales por tienda y vendedor.
            </span>
          </div>
        </article>
      </section>
    </div>
  );
}

export default Dashboard;
