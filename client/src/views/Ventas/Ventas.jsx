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
          <div className="sale-match-product">
            <strong>{item.codigo}</strong>
            {item.descripcion && item.descripcion !== item.codigo && (
              <span className="sale-match-description">
                {item.descripcion}
              </span>
            )}
          </div>

          <div className="sale-match-values">
            <span>{number.format(Number(item.cantidad || 0))} unidades</span>
            <strong>
              {currency.format(Number(item.montoBruto || 0))}
            </strong>
          </div>
        </div>
      ))}
    </div>
  );
}

function Ventas() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState("loading");
  const [data, setData] = useState([]);
  const [productSummary, setProductSummary] = useState([]);
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
        setProductSummary(response.resumenProductos ?? []);
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

  const productBreakdown = useMemo(() => {
    const summaryMap = new Map(
      productSummary.map((item) => [
        String(item.codigo).toUpperCase(),
        item,
      ])
    );

    return selectedProducts.map((code) => {
      const found = summaryMap.get(String(code).toUpperCase());

      return (
        found ?? {
          codigo: code,
          descripcion: code,
          unidadesVendidas: 0,
          montoVendido: 0,
          documentos: 0,
          fr: 0,
          fd: 0,
        }
      );
    });
  }, [productSummary, selectedProducts]);

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
              ? "Monto total seleccionado"
              : "Monto vendido"}
          </span>
          <strong>
            {currency.format(Number(summary.monto || 0))}
          </strong>
        </article>
      </section>

      {hasProductFilter && (
        <section className="panel sales-product-summary-panel">
          <header className="module-header">
            <div>
              <span className="panel-eyebrow">Productos seleccionados</span>
              <h2>Venta por código</h2>
            </div>
            <span className="module-count">
              {selectedProducts.length}{" "}
              {selectedProducts.length === 1 ? "código" : "códigos"}
            </span>
          </header>

          <div className="sales-product-summary-grid">
            {productBreakdown.map((product) => (
              <article
                className="sales-product-summary-card"
                key={product.codigo}
              >
                <div className="sales-product-summary-heading">
                  <div>
                    <strong>{product.codigo}</strong>
                    {product.descripcion &&
                      product.descripcion !== product.codigo && (
                        <span>{product.descripcion}</span>
                      )}
                  </div>

                  <span>
                    {number.format(
                      Number(product.unidadesVendidas || 0)
                    )}{" "}
                    unidades
                  </span>
                </div>

                <div className="sales-product-summary-amount">
                  {currency.format(Number(product.montoVendido || 0))}
                </div>

                <div className="sales-product-summary-meta">
                  <span>
                    {product.documentos}{" "}
                    {product.documentos === 1
                      ? "documento"
                      : "documentos"}
                  </span>
                  <span>
                    {product.fr} FR · {product.fd} FD
                  </span>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

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
            Cada código se muestra por separado con sus propias unidades y
            su propio monto vendido. Si un código aparece varias veces dentro
            de una misma FR/FD, Micapp agrupa esas líneas para ese código.
            <strong> Monto seleccionados</strong> suma los importes de los
            códigos buscados dentro del documento, mientras que
            <strong> Total documento</strong> muestra la venta completa solo
            como referencia.
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
                      <th>Detalle por código</th>
                      <th className="numeric">Monto seleccionados</th>
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
