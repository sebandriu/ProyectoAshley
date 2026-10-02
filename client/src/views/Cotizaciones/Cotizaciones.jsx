import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { getQuoteAnalytics } from "../../services/api";

const currency = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

function formatDate(value) {
  const match = String(value ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "—";
}

function Cotizaciones() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState("loading");
  const [data, setData] = useState([]);
  const [error, setError] = useState("");

  const filters = useMemo(() => {
    const legacyDate = searchParams.get("fecha") || undefined;

    return {
      desde: searchParams.get("desde") || legacyDate,
      hasta: searchParams.get("hasta") || legacyDate,
      tienda: searchParams.get("tienda") || undefined,
      vendedor: searchParams.get("vendedor") || undefined,
      productos:
        searchParams.get("productos") ||
        searchParams.get("producto") ||
        undefined,
    };
  }, [searchParams]);

  useEffect(() => {
    let active = true;
    setStatus("loading");
    setError("");

    getQuoteAnalytics(filters)
      .then((response) => {
        if (!active) return;
        setData(response.cotizaciones ?? []);
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

  const summary = useMemo(() => {
    return data.reduce(
      (acc, quote) => {
        acc.total += 1;
        acc.monto += Number(quote.totalBruto || 0);

        if (quote.estadoAnalitico === "PENDIENTE") acc.pendientes += 1;
        if (
          quote.estadoAnalitico === "CONVERTIDA COMPLETA" ||
          quote.estadoAnalitico === "CONVERSION PARCIAL"
        ) {
          acc.conVenta += 1;
        }
        if (quote.estadoAnalitico === "CERRADA SIN VENTA") {
          acc.sinVenta += 1;
        }

        return acc;
      },
      { total: 0, pendientes: 0, conVenta: 0, sinVenta: 0, monto: 0 }
    );
  }, [data]);

  return (
    <div className="page">
      <section className="module-summary-grid">
        <article className="summary-card">
          <span>Cotizaciones</span>
          <strong>{summary.total}</strong>
        </article>
        <article className="summary-card">
          <span>Con venta</span>
          <strong>{summary.conVenta}</strong>
        </article>
        <article className="summary-card">
          <span>Pendientes</span>
          <strong>{summary.pendientes}</strong>
        </article>
        <article className="summary-card">
          <span>Monto cotizado</span>
          <strong>{currency.format(summary.monto)}</strong>
        </article>
      </section>

      <section className="panel module-panel">
        <header className="module-header">
          <div>
            <span className="panel-eyebrow">Detalle comercial</span>
            <h2>Cotizaciones</h2>
          </div>
          <span className="module-count">{data.length} documentos</span>
        </header>

        {status === "loading" && (
          <div className="module-state">Cargando cotizaciones...</div>
        )}

        {status === "error" && (
          <div className="module-state error">{error}</div>
        )}

        {status === "success" && data.length === 0 && (
          <div className="module-state">
            No hay cotizaciones para los filtros seleccionados.
          </div>
        )}

        {status === "success" && data.length > 0 && (
          <div className="table-scroll">
            <table className="analytics-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>N° OF</th>
                  <th>Estado</th>
                  <th>Tienda</th>
                  <th>Vendedor</th>
                  <th>Productos</th>
                  <th>Unidades</th>
                  <th className="numeric">Total bruto</th>
                </tr>
              </thead>
              <tbody>
                {data.map((quote) => (
                  <tr key={quote.docentry}>
                    <td>{formatDate(quote.fecha)}</td>
                    <td>{quote.numero ?? "—"}</td>
                    <td>
                      <span className="state-chip">
                        {quote.estadoAnalitico ?? quote.estadoSap ?? "—"}
                      </span>
                    </td>
                    <td>{quote.tienda ?? "—"}</td>
                    <td>{quote.vendedor ?? "—"}</td>
                    <td>{quote.lineasProducto}</td>
                    <td>{quote.unidadesProducto}</td>
                    <td className="numeric">
                      {currency.format(Number(quote.totalBruto || 0))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default Cotizaciones;
