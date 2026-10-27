import { useId } from "react";

import "./RadarChart.css";

const axes = [
  { key: "montoVendido", label: "Monto vendido", type: "currency" },
  { key: "ventas", label: "Ventas válidas", type: "integer" },
  { key: "cotizaciones", label: "Cotizaciones", type: "integer" },
  { key: "conversionPct", label: "Cierre OF", type: "percent" },
  { key: "ticketPromedio", label: "Ticket promedio", type: "currency" },
];

const colors = ["#f28c28", "#577e9e", "#8875b4"];

const integerFormatter = new Intl.NumberFormat("es-CL", {
  maximumFractionDigits: 0,
});

const currencyFormatter = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

function metricValue(row, key) {
  if (key === "ticketPromedio") {
    const explicit = row.ticketPromedio;
    if (explicit !== undefined && explicit !== null) {
      return Math.max(0, Number(explicit) || 0);
    }

    const sales = Number(row.ventas) || 0;
    return sales > 0 ? Math.max(0, (Number(row.montoVendido) || 0) / sales) : 0;
  }

  if (key === "conversionPct" && row.conversionPct == null) {
    return null;
  }

  const number = Number(row[key]);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function formatMetric(value, type) {
  if (value === null || value === undefined) return "Sin base comparable";
  if (type === "currency") return currencyFormatter.format(value);
  if (type === "percent") {
    return value.toLocaleString("es-CL", { maximumFractionDigits: 1 }) + "%";
  }
  return integerFormatter.format(value);
}

function position(index, count, radius, cx = 280, cy = 172) {
  const angle = -Math.PI / 2 + (2 * Math.PI * index) / count;
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  };
}

function polygon(values, radius = 112) {
  return values
    .map((value, index) => {
      const point = position(index, values.length, radius * (value.score / 100));
      return point.x.toFixed(2) + "," + point.y.toFixed(2);
    })
    .join(" ");
}

function prepareSeries(rows, referenceRows) {
  const maxima = Object.fromEntries(
    axes.map((axis) => [
      axis.key,
      Math.max(
        0,
        ...referenceRows.map((row) => metricValue(row, axis.key) ?? 0)
      ),
    ])
  );

  return rows.map((row, index) => ({
    id: row.id ?? row.label ?? index,
    label: row.label || "Serie " + (index + 1),
    color: colors[index % colors.length],
    values: axes.map((axis) => {
      const raw = metricValue(row, axis.key);
      const maximum = maxima[axis.key];
      const score =
        raw == null
          ? 0
          : axis.type === "percent"
            ? Math.min(100, raw)
            : maximum > 0
              ? Math.min(100, (raw / maximum) * 100)
              : 0;

      return {
        raw,
        score,
        display: formatMetric(raw, axis.type),
      };
    }),
  }));
}

function RadarChart({ rows = [], referenceRows, emptyMessage }) {
  const titleId = useId();
  const descriptionId = useId();
  const comparisonRows = referenceRows?.length ? referenceRows : rows;
  const series = prepareSeries(rows.slice(0, 3), comparisonRows);
  const hasValues = series.some((item) =>
    item.values.some((value) => value.score > 0)
  );
  const comparisons = series.length === 2
    ? axes.map((axis, index) => {
        const current = series[0].values[index].raw;
        const previous = series[1].values[index].raw;
        if (current == null || previous == null) return null;
        const diff = axis.type === "percent"
          ? current - previous
          : previous > 0
            ? ((current - previous) / previous) * 100
            : null;
        return diff === null
          ? null
          : {
              label: axis.label,
              value: diff,
              text: `${diff > 0 ? "+" : ""}${diff.toLocaleString("es-CL", {
                maximumFractionDigits: 1,
              })}${axis.type === "percent" ? " pp" : "%"}`,
            };
      }).filter(Boolean)
    : [];

  if (!series.length || !hasValues) {
    return (
      <div className="radar-chart-empty">
        {emptyMessage || "No hay datos suficientes para comparar los perfiles comerciales."}
      </div>
    );
  }

  const center = { x: 280, y: 172 };
  const radius = 112;

  return (
    <div className="radar-chart">
      <svg
        className="radar-chart-svg"
        viewBox="0 0 560 350"
        role="img"
        aria-labelledby={titleId + " " + descriptionId}
      >
        <title id={titleId}>Perfil comercial comparativo</title>
        <desc id={descriptionId}>
          Radar con cinco indicadores normalizados de cero a cien:
          monto vendido, ventas válidas, cotizaciones, cierre OF y ticket promedio.
          Los valores originales están disponibles en una tabla accesible y al pasar por los puntos.
        </desc>

        {[20, 40, 60, 80, 100].map((level) => (
          <polygon
            key={level}
            className="radar-chart-ring"
            points={axes
              .map((_, index) => {
                const p = position(index, axes.length, (radius * level) / 100);
                return p.x + "," + p.y;
              })
              .join(" ")}
          />
        ))}

        {axes.map((axis, index) => {
          const edge = position(index, axes.length, radius);
          const labelPoint = position(index, axes.length, radius + 38);
          const anchor =
            labelPoint.x < center.x - 12
              ? "end"
              : labelPoint.x > center.x + 12
                ? "start"
                : "middle";

          return (
            <g key={axis.key}>
              <line
                className="radar-chart-axis"
                x1={center.x}
                y1={center.y}
                x2={edge.x}
                y2={edge.y}
              />
              <text
                className="radar-chart-axis-label"
                x={labelPoint.x}
                y={labelPoint.y + 4}
                textAnchor={anchor}
              >
                {axis.label}
              </text>
            </g>
          );
        })}

        {series.map((item) => (
          <g key={item.id} className="radar-chart-series">
            <polygon
              points={polygon(item.values, radius)}
              fill={item.color}
              fillOpacity="0.13"
              stroke={item.color}
              strokeWidth="2.6"
              strokeLinejoin="round"
            />
            {item.values.map((value, index) => {
              const point = position(
                index,
                axes.length,
                radius * (value.score / 100)
              );
              return (
                <circle
                  key={axes[index].key}
                  cx={point.x}
                  cy={point.y}
                  r="4"
                  fill={item.color}
                  stroke="#ffffff"
                  strokeWidth="1.5"
                >
                  <title>
                    {item.label + " · " + axes[index].label + ": " + value.display}
                  </title>
                </circle>
              );
            })}
          </g>
        ))}
      </svg>

      <div className="radar-chart-legend" aria-label="Series comparadas">
        {series.map((item) => (
          <span key={item.id}>
            <i style={{ backgroundColor: item.color }} aria-hidden="true" />
            {item.label}
          </span>
        ))}
      </div>

      <p className="radar-chart-note">
        La figura muestra perfiles relativos (escala 0–100), no una nota de
        desempeño: montos y cantidades se escalan con el máximo del grupo;
        el cierre OF utiliza su porcentaje real.
      </p>

      {comparisons.length > 0 && (
        <div className="radar-chart-insights">
          {comparisons
            .filter((change) =>
              ["Monto vendido", "Cierre OF", "Ticket promedio"].includes(change.label)
            )
            .map((change) => (
              <div className="radar-insight" key={change.label}>
                <span>{change.label}</span>
                <strong className={change.value < 0 ? "negative" : "positive"}>
                  {change.text}
                </strong>
                <small>vs año anterior</small>
              </div>
            ))}
        </div>
      )}

      <div className="radar-chart-data">
        <table>
          <caption>Indicadores reales y posición relativa por eje</caption>
          <thead>
            <tr>
              <th scope="col">Indicador</th>
              {series.map((item) => (
                <th scope="col" key={item.id}>{item.label}</th>
              ))}
              {series.length === 2 && <th scope="col">Cambio</th>}
            </tr>
          </thead>
          <tbody>
            {axes.map((axis, index) => {
              const comparison = comparisons.find((c) => c.label === axis.label);
              const topValue = Math.max(
                0,
                ...series.map((item) => item.values[index].raw ?? 0)
              );
              return (
                <tr key={axis.key}>
                  <th scope="row">{axis.label}</th>
                  {series.map((item) => (
                    <td key={item.id}>
                      <strong>{item.values[index].display}</strong>
                      {series.length > 2 &&
                        topValue > 0 &&
                        item.values[index].raw === topValue && (
                          <small className="radar-leader-label">Líder en este eje</small>
                        )}
                      <div
                        className="radar-metric-track"
                        title={`Posición relativa: ${Math.round(item.values[index].score)} de 100`}
                      >
                        <span
                          style={{
                            width: `${item.values[index].score}%`,
                            backgroundColor: item.color,
                          }}
                        />
                      </div>
                    </td>
                  ))}
                  {series.length === 2 && (
                    <td className={comparison?.value < 0 ? "radar-negative" : "radar-positive"}>
                      {comparison?.text ?? "Sin base"}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default RadarChart;
