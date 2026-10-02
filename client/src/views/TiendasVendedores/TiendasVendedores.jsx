import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { getPerformanceAnalytics } from "../../services/api";

const currency = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

function formatPercent(value) {
  if (value === null || value === undefined) return "—";
  return `${Number(value).toLocaleString("es-CL", { maximumFractionDigits: 2 })}%`;
}

function PerformanceTable({ rows, type }) {
  if (!rows.length) {
    return (
      <div className="module-state compact">
        Sin información para los filtros seleccionados.
      </div>
    );
  }

  return (
    <div className="table-scroll">
      <table className="analytics-table">
        <thead>
          <tr>
            <th>{type === "store" ? "Tienda" : "Vendedor"}</th>
            {type === "seller" && <th>Tienda</th>}
            <th className="numeric">Cotizaciones</th>
            <th className="numeric">Ventas</th>
            <th className="numeric">Cierre OF</th>
            <th className="numeric">Monto vendido</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={type === "store" ? row.tienda : `${row.tienda}-${row.vendedor}`}>
              <td>{type === "store" ? row.tienda : row.vendedor}</td>
              {type === "seller" && <td>{row.tienda ?? "—"}</td>}
              <td className="numeric">{row.cotizaciones}</td>
              <td className="numeric">{row.ventas}</td>
              <td className="numeric">{formatPercent(row.conversionPct)}</td>
              <td className="numeric">{currency.format(row.montoVendido)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TiendasVendedores() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState("loading");
  const [data, setData] = useState({ tiendas: [], vendedores: [] });
  const [error, setError] = useState("");

  const filters = useMemo(() => {
    const legacyDate = searchParams.get("fecha") || undefined;

    return {
      desde: searchParams.get("desde") || legacyDate,
      hasta: searchParams.get("hasta") || legacyDate,
      tienda: searchParams.get("tienda") || undefined,
      vendedores:
        searchParams.get("vendedores") ||
        searchParams.get("vendedor") ||
        undefined,
    };
  }, [searchParams]);

  useEffect(() => {
    let active = true;
    setStatus("loading");
    setError("");

    getPerformanceAnalytics(filters)
      .then((response) => {
        if (!active) return;
        setData(response);
        setStatus("success");
      })
      .catch((requestError) => {
        if (!active) return;
        setError(requestError.message);
        setStatus("error");
      });

    return () => {
      active = false;
    };
  }, [filters]);

  const stores = data.tiendas ?? [];
  const sellers = data.vendedores ?? [];
  const totalSold = stores.reduce(
    (sum, store) => sum + Number(store.montoVendido || 0),
    0
  );

  return (
    <div className="page">
      <section className="module-summary-grid">
        <article className="summary-card">
          <span>Tiendas analizadas</span>
          <strong>{stores.length}</strong>
        </article>
        <article className="summary-card">
          <span>Vendedores analizados</span>
          <strong>{sellers.length}</strong>
        </article>
        <article className="summary-card">
          <span>Ventas</span>
          <strong>{stores.reduce((sum, store) => sum + store.ventas, 0)}</strong>
        </article>
        <article className="summary-card">
          <span>Monto vendido</span>
          <strong>{currency.format(totalSold)}</strong>
        </article>
      </section>

      {status === "loading" && (
        <section className="panel module-state">
          Analizando tiendas y vendedores...
        </section>
      )}

      {status === "error" && (
        <section className="panel module-state error">{error}</section>
      )}

      {status === "success" && (
        <section className="performance-grid">
          <article className="panel module-panel">
            <header className="module-header">
              <div>
                <span className="panel-eyebrow">Rendimiento</span>
                <h2>Tiendas</h2>
              </div>
              <span className="module-count">{stores.length}</span>
            </header>
            <PerformanceTable rows={stores} type="store" />
          </article>

          <article className="panel module-panel">
            <header className="module-header">
              <div>
                <span className="panel-eyebrow">Rendimiento</span>
                <h2>Vendedores</h2>
              </div>
              <span className="module-count">{sellers.length}</span>
            </header>
            <PerformanceTable rows={sellers} type="seller" />
          </article>
        </section>
      )}
    </div>
  );
}

export default TiendasVendedores;
