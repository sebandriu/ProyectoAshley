import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { getSalesAnalytics } from "../../services/api";

const currency = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

const number = new Intl.NumberFormat("es-CL", {
  maximumFractionDigits: 2,
});

function formatDate(value) {
  const match = String(value ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "—";
}

function parseList(value) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function SaleMatches({ matches }) {
  if (!Array.isArray(matches) || matches.length === 0) {
    return <span>—</span>;
  }

  return (
    <div className="sale-match-list">
      {matches.map((item) => (
        <div className="sale-match-item" key={item.codigo}>
          <strong>{item.codigo}</strong>
          <span>
            {number.format(Number(item.cantidad || 0))} u. ·{" "}
            {currency.format(Number(item.montoBruto || 0))}
          </span>
        </div>
      ))}
    </div>
  );
}

function Ventas() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState("loading");
  const [data, setData] = useState([]);
  const [summary, setSummary] = useState({
    validas: 0,
    fr: 0,
    fd: 0,
    canceladas: 0,
    monto: 0,
    montoEsFiltrado: false,
  });
  const [error, setError] = useState("");

  const selectedProducts = useMemo(
    () =>
      parseList(
        searchParams.get("productos") ||
          searchParams.get("producto")
      ),
    [searchParams]
  );

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
        setSummary(
          response.resumen ?? {
            validas: 0,
            fr: 0,
            fd: 0,
            canceladas: 0,
            monto: 0,
            montoEsFiltrado: false,
          }
        );
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

  const hasProductFilter = selectedProducts.length > 0;

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
          <span>
            {hasProductFilter
              ? "Monto vendido filtrado"
              : "Monto vendido"}
          </span>
          <strong>
            {currency.format(Number(summary.monto || 0))}
          </strong>
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

        {hasProductFilter && (
          <div className="filter-context-note">
            {selectedProducts.length > 1
              ? "Con varios códigos seleccionados, se muestra una FR/FD si contiene al menos uno de ellos. "
              : "La FR/FD se muestra cuando contiene el código seleccionado. "}
            <strong>Monto filtrado</strong> suma únicamente las líneas de los
            productos buscados. <strong>Total documento</strong> se mantiene
            solo como referencia de la venta completa.
          </div>
        )}

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
            <table
              className={
                hasProductFilter
                  ? "analytics-table sales-table filtered"
                  : "analytics-table sales-table"
              }
            >
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>N° Documento</th>
                  <th>Folio</th>
                  <th>Estado</th>
                  <th>Tienda</th>
                  <th>Vendedor</th>

                  {hasProductFilter ? (
                    <>
                      <th>Productos filtrados</th>
                      <th className="numeric">Unid. filtradas</th>
                      <th className="numeric">Monto filtrado</th>
                      <th className="numeric">Total documento</th>
                    </>
                  ) : (
                    <>
                      <th className="numeric">Unidades</th>
                      <th className="numeric">Total bruto</th>
                    </>
                  )}
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
                      <span
                        className={`state-chip ${
                          sale.valida ? "success" : "muted"
                        }`}
                      >
                        {sale.valida ? "Válida" : "Cancelada"}
                      </span>
                    </td>
                    <td>{sale.tienda ?? "—"}</td>
                    <td>{sale.vendedor ?? "—"}</td>

                    {hasProductFilter ? (
                      <>
                        <td className="sale-matches-cell">
                          <SaleMatches
                            matches={sale.productosCoincidentes}
                          />
                        </td>
                        <td className="numeric">
                          {number.format(
                            Number(sale.unidadesCoincidentes || 0)
                          )}
                        </td>
                        <td className="numeric filtered-sale-amount">
                          {currency.format(
                            Number(sale.montoCoincidente || 0)
                          )}
                        </td>
                        <td className="numeric sale-document-total">
                          {currency.format(
                            Number(sale.totalBruto || 0)
                          )}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="numeric">
                          {number.format(
                            Number(sale.unidadesProducto || 0)
                          )}
                        </td>
                        <td className="numeric">
                          {currency.format(
                            Number(sale.totalBruto || 0)
                          )}
                        </td>
                      </>
                    )}
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
