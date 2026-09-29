import "./KpiCard.css";

function KpiCard({ title, value = "—", icon: Icon, caption }) {
  return (
    <article className="kpi-card">
      <div className="kpi-card-top">
        <div className="kpi-icon" aria-hidden="true">
          <Icon size={16} strokeWidth={1.9} />
        </div>

        <span className="kpi-label">{title}</span>
      </div>

      <div className="kpi-value">{value}</div>

      <div className="kpi-caption">
        {caption || "Sin información cargada"}
      </div>
    </article>
  );
}

export default KpiCard;
