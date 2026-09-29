function Dashboard() {
  return (
    <div className="page">
      <section className="kpi-grid">
        <div className="kpi-card">
          <span>Cotizaciones</span>
          <strong>—</strong>
        </div>

        <div className="kpi-card">
          <span>Ventas</span>
          <strong>—</strong>
        </div>

        <div className="kpi-card">
          <span>Conversión</span>
          <strong>—</strong>
        </div>

        <div className="kpi-card">
          <span>Monto cotizado</span>
          <strong>—</strong>
        </div>

        <div className="kpi-card">
          <span>Ticket promedio</span>
          <strong>—</strong>
        </div>
      </section>

      <section className="dashboard-grid">
        <div className="panel panel-large">
          <h2>Evolución comercial</h2>

          <div className="empty-content">
            Sin información cargada
          </div>
        </div>

        <div className="panel">
          <h2>Productos destacados</h2>

          <div className="empty-content">
            Sin información cargada
          </div>
        </div>
      </section>

      <section className="panel">
        <h2>Resumen comercial</h2>

        <div className="empty-content compact">
          Sin información cargada
        </div>
      </section>
    </div>
  );
}

export default Dashboard;