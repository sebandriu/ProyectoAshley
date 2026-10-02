import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { getProductAnalytics } from "../../services/api";

const number = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 2 });
const currency = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

function Productos() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState("loading");
  const [data, setData] = useState({ resumen: {}, productos: [] });
  const [error, setError] = useState("");

  const filters = useMemo(() => {
    const legacyDate = searchParams.get("fecha") || undefined;

    return {
      desde: searchParams.get("desde") || legacyDate,
      hasta: searchParams.get("hasta") || legacyDate,
      tienda: searchParams.get("tienda") || undefined,
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

    getProductAnalytics(filters)
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

  const summary = data.resumen ?? {};
  const products = data.productos ?? [];

  return (
    <div className="page">
      <section className="module-summary-grid">
        <article className="summary-card">
          <span>Unidades cotizadas</span>
          <strong>{number.format(summary.unidadesCotizadas ?? 0)}</strong>
        </article>
        <article className="summary-card">
          <span>Unidades convertidas</span>
          <strong>{number.format(summary.unidadesConvertidas ?? 0)}</strong>
        </article>
        <article className="summary-card">
          <span>Demanda no convertida</span>
          <strong>{number.format(summary.demandaNoConvertida ?? 0)}</strong>
        </article>
        <article className="summary-card">
          <span>Conversión por unidades</span>
          <strong>
            {summary.conversionUnidadesPct == null
              ? "—"
              : `${number.format(summary.conversionUnidadesPct)}%`}
          </strong>
        </article>
      </section>

      <section className="panel module-panel">
        <header className="module-header">
          <div>
            <span className="panel-eyebrow">Análisis</span>
            <h2>Productos y demanda</h2>
          </div>
          <span className="module-count">{products.length} productos</span>
        </header>

        {status === "loading" && (
          <div className="module-state">Analizando productos...</div>
        )}

        {status === "error" && (
          <div className="module-state error">{error}</div>
        )}

        {status === "success" && products.length === 0 && (
          <div className="module-state">
            No hay productos para los filtros seleccionados.
          </div>
        )}

        {status === "success" && products.length > 0 && (
          <div className="table-scroll">
            <table className="analytics-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Producto</th>
                  <th className="numeric">Cotizadas</th>
                  <th className="numeric">Convertidas</th>
                  <th className="numeric">No convertidas</th>
                  <th className="numeric">Vendidas</th>
                  <th className="numeric">Conversión</th>
                  <th className="numeric">Monto vendido</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.codigo}>
                    <td>{product.codigo}</td>
                    <td>{product.descripcion}</td>
                    <td className="numeric">
                      {number.format(product.unidadesCotizadas)}
                    </td>
                    <td className="numeric">
                      {number.format(product.unidadesConvertidas)}
                    </td>
                    <td className="numeric demand-value">
                      {number.format(product.demandaNoConvertida)}
                    </td>
                    <td className="numeric">
                      {number.format(product.unidadesVendidas)}
                    </td>
                    <td className="numeric">
                      {product.conversionUnidadesPct == null
                        ? "—"
                        : `${number.format(product.conversionUnidadesPct)}%`}
                    </td>
                    <td className="numeric">
                      {currency.format(product.montoVendido)}
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

export default Productos;
