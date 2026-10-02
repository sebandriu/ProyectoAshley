import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { getSalesAnalytics } from "../../services/api";

const currency = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

function formatDate(value) {
  const match = String(value ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "—";
}

function Ventas() {
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
      vendedores:
        searchParams.get("vendedores") ||
        searchParams.get("vendedor") ||
        undefined,
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

    getSalesAnalytics(filters)
      .then((response) => {
        if (!active) return;
        setData(response.ventas ?? []);
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
      (acc, sale) => {
        if (sale.valida) {
          acc.validas += 1;
          acc.monto += Number(sale.totalBruto || 0);
          if (sale.tipo === "FR") acc.fr += 1;
          if (sale.tipo === "FD") acc.fd += 1;
        } else {
          acc.canceladas += 1;
        }

        return acc;
      },
      { validas: 0, fr: 0, fd: 0, canceladas: 0, monto: 0 }
    );
  }, [data]);

  return (
    <div className="page">
      <section className="module-summary-grid">
        <article className="summary-card">
          <span>Ventas válidas</span>
          <strong>{summary.validas}</strong>
        </article>
        <article className="summary-card">
          <span>FR</span>
          <strong>{summary.fr}</strong>
        </article>
        <article className="summary-card">
          <span>FD</span>
          <strong>{summary.fd}</strong>
        </article>
        <article className="summary-card">
          <span>Monto vendido</span>
          <strong>{currency.format(summary.monto)}</strong>
        </article>
      </section>

      <section className="panel module-panel">
        <header className="module-header">
          <div>
            <span className="panel-eyebrow">Detalle comercial</span>
            <h2>Ventas</h2>
          </div>
          <span className="module-count">{data.length} documentos</span>
        </header>

        {status === "loading" && (
          <div className="module-state">Cargando ventas...</div>
        )}

        {status === "error" && (
          <div className="module-state error">{error}</div>
        )}

        {status === "success" && data.length === 0 && (
          <div className="module-state">
            No hay ventas para los filtros seleccionados.
          </div>
        )}

        {status === "success" && data.length > 0 && (
          <div className="table-scroll">
            <table className="analytics-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>N° Documento</th>
                  <th>Folio</th>
                  <th>Estado</th>
                  <th>Tienda</th>
                  <th>Vendedor</th>
                  <th>Unidades</th>
                  <th className="numeric">Total bruto</th>
                </tr>
              </thead>
              <tbody>
                {data.map((sale) => (
                  <tr key={`${sale.tipo}-${sale.docentry}`}>
                    <td>{formatDate(sale.fecha)}</td>
                    <td>{sale.tipo}</td>
                    <td>{sale.numero ?? "—"}</td>
                    <td>{sale.folio ?? "—"}</td>
                    <td>
                      <span className={`state-chip ${sale.valida ? "success" : "muted"}`}>
                        {sale.valida ? "Válida" : "Cancelada"}
                      </span>
                    </td>
                    <td>{sale.tienda ?? "—"}</td>
                    <td>{sale.vendedor ?? "—"}</td>
                    <td>{sale.unidadesProducto}</td>
                    <td className="numeric">
                      {currency.format(Number(sale.totalBruto || 0))}
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

export default Ventas;
