import { useEffect, useState } from "react";\nimport { Link } from "react-router-dom";
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

import KpiCard from "../../components/KpiCard/KpiCard";\nimport { getSystemHealth } from "../../services/api";

const kpis = [
  {
    title: "Cotizaciones",
    icon: FileText,
    caption: "Ofertas comerciales registradas",
  },
  {
    title: "Ventas",
    icon: BadgeDollarSign,
    caption: "Documentos convertidos en venta",
  },
  {
    title: "Conversión",
    icon: Percent,
    caption: "Relación cotización / venta",
  },
  {
    title: "Monto cotizado",
    icon: CircleDollarSign,
    caption: "Valor comercial cotizado",
  },
  {
    title: "Ticket promedio",
    icon: ReceiptText,
    caption: "Promedio por operación",
  },
];

function Dashboard() {
  return (
    <div className="page dashboard-page">
      <section className="kpi-grid" aria-label="Indicadores principales">
        {kpis.map((kpi) => (
          <KpiCard
            key={kpi.title}
            title={kpi.title}
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
              <span className="metric-tag active">Cotizaciones</span>
              <span className="metric-tag">Ventas</span>
              <span className="metric-tag">Conversión</span>
            </div>
          </header>

          <div className="visual-placeholder">
            <div className="visual-placeholder-content">
              <div className="visual-placeholder-icon">
                <BarChart3 size={22} strokeWidth={1.7} />
              </div>

              <strong>Visualización comercial</strong>
              <span>
                El gráfico se mostrará cuando exista información procesada.
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
                  ? "PostgreSQL está disponible"
                  : "Aún no hay información cargada"}
              </h3>
              <p>
                {databaseOnline
                  ? "Micapp ya puede comunicarse con el backend y la base de datos. El siguiente incremento incorporará la importación y el ETL de archivos SAP."
                  : "Inicia el backend y PostgreSQL para habilitar la capa de datos de Micapp."}
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
