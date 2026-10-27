import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { getSalesAnalytics } from "../../services/api";
import ProductScopeFilters from "../../components/ProductScopeFilters/ProductScopeFilters";
import Pagination from "../../components/ProductScopeFilters/Pagination";

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

function SortableHeader({
  label,
  sortKey,
  sort,
  onSort,
  numeric = false,
  defaultDirection,
}) {
  const active = sort.key === sortKey;
  const symbol = active
    ? sort.direction === "asc"
      ? "↑"
      : "↓"
    : "↕";

  return (
    <th
      className={numeric ? "numeric sortable-th" : "sortable-th"}
      aria-sort={
        active
          ? sort.direction === "asc"
            ? "ascending"
            : "descending"
          : "none"
      }
    >
      <button
        type="button"
        className="table-sort-button"
        onClick={() =>
          onSort(
            sortKey,
            defaultDirection ?? (numeric ? "desc" : "asc")
          )
        }
      >
        <span>{label}</span>
        <span className={active ? "sort-symbol active" : "sort-symbol"}>
          {symbol}
        </span>
      </button>
    </th>
  );
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
            <strong>{item.codigoAshley || item.codigo}</strong>
            {item.codigoAshley && <small>SKU: {item.codigo}</small>}
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
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [sort, setSort] = useState({
    key: "fecha",
    direction: "desc",
  });

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
      categoriaGeneral: searchParams.get("categoriaGeneral") || undefined,
      codigoAshley: searchParams.get("codigoAshley") || undefined,
      page,
      orderBy: sort.key,
      orderDir: sort.direction,
    };
  }, [searchParams, sort, page]);

  useEffect(() => { setPage(1); }, [searchParams]);

  useEffect(() => {
    let active = true;
    setStatus("loading");
    setError("");

    getSalesAnalytics(filters)
      .then((response) => {
        if (!active) return;

        setData(response.ventas ?? []);
        setPagination(response.paginacion ?? null);
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

  const hasProductFilter = selectedProducts.length > 0 ||
    Boolean(filters.categoriaGeneral || filters.codigoAshley);
  const productBreakdown = productSummary.slice(0, 3);
  const averageSelected = summary.validas > 0
    ? Number(summary.monto || 0) / summary.validas
    : 0;

  function handleSort(key, defaultDirection) {
    setPage(1);
    setSort((current) => {
      if (current.key === key) {
        return {
          key,
          direction:
            current.direction === "asc" ? "desc" : "asc",
        };
      }

      return {
        key,
        direction: defaultDirection,
      };
    });
  }

  return (
    <div className="page">
      <ProductScopeFilters />
      <section className="module-summary-grid">
        <article className="summary-card">
          <span>Ventas válidas</span>
          <strong>{summary.validas}</strong>
        </article>
        <article className="summary-card">
          <span>{hasProductFilter ? "Venta de productos filtrados" : "Monto vendido"}</span>
          <strong>{currency.format(Number(summary.monto || 0))}</strong>
        </article>
        <article className="summary-card">
          <span>{hasProductFilter ? "Promedio filtrado por documento" : "Ticket promedio"}</span>
          <strong>{summary.validas ? currency.format(averageSelected) : "—"}</strong>
        </article>
        <article className="summary-card">
          <span>Canceladas</span>
          <strong>{summary.canceladas}</strong>
        </article>
      </section>

      {status === "success" && (
        <p className="module-insight">
          <strong>{summary.fr} facturas de reserva</strong> (FR) y
          {" "}<strong>{summary.fd} facturas de deudores</strong> (FD).
          {hasProductFilter && (
            <> Los montos corresponden exclusivamente a productos coincidentes;
              las facturas completas se consultan en el detalle.</>
          )}
        </p>
      )}

      {status === "success" && productBreakdown.length > 0 && (
        <section className="panel sales-product-summary-panel">
          <header className="module-header">
            <div>
              <span className="panel-eyebrow">{hasProductFilter ? "Productos del filtro" : "Productos más vendidos"}</span>
              <h2>Productos de mayor venta</h2>
            </div>
            <span className="module-count">
Top {productBreakdown.length}
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
                    <strong>{product.codigoAshley || product.codigo}</strong>
                    {product.codigoAshley && <span>SKU SAP: {product.codigo}</span>}
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
          <span className="module-count">{pagination?.total ?? 0} documentos encontrados</span>
        </header>

        {hasProductFilter && (
          <p className="module-subtitle">
            Cada factura puede contener productos de distintas categorías.
            El monto seleccionado suma solo las líneas del filtro;
            el total de la factura se conserva como referencia.
          </p>
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
          <details className="module-details">
            <summary>Ver detalle de facturas ({data.length})</summary>
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
                  <SortableHeader
                    label="Fecha"
                    sortKey="fecha"
                    sort={sort}
                    onSort={handleSort}
                    defaultDirection="desc"
                  />
                  <SortableHeader
                    label="Tipo"
                    sortKey="tipo"
                    sort={sort}
                    onSort={handleSort}
                  />
                  <SortableHeader
                    label="N° Documento"
                    sortKey="numero"
                    sort={sort}
                    onSort={handleSort}
                    numeric
                  />
                  <SortableHeader
                    label="Folio"
                    sortKey="folio"
                    sort={sort}
                    onSort={handleSort}
                    numeric
                  />
                  <SortableHeader
                    label="Estado"
                    sortKey="estado"
                    sort={sort}
                    onSort={handleSort}
                  />
                  <SortableHeader
                    label="Tienda"
                    sortKey="tienda"
                    sort={sort}
                    onSort={handleSort}
                  />
                  <SortableHeader
                    label="Vendedor"
                    sortKey="vendedor"
                    sort={sort}
                    onSort={handleSort}
                  />
                  <SortableHeader
                    label="Productos"
                    sortKey="productos"
                    sort={sort}
                    onSort={handleSort}
                    numeric
                  />
                  <SortableHeader
                    label="Unidades"
                    sortKey="unidades"
                    sort={sort}
                    onSort={handleSort}
                    numeric
                  />

                  {hasProductFilter ? (
                    <>
                      <th>Detalle por código</th>
                      <SortableHeader
                        label="Monto seleccionado"
                        sortKey="montoSeleccionado"
                        sort={sort}
                        onSort={handleSort}
                        numeric
                      />
                      <SortableHeader
                        label="Total documento"
                        sortKey="totalBruto"
                        sort={sort}
                        onSort={handleSort}
                        numeric
                      />
                    </>
                  ) : (
                    <SortableHeader
                      label="Total bruto"
                      sortKey="totalBruto"
                      sort={sort}
                      onSort={handleSort}
                      numeric
                    />
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
                    <td className="numeric">
                      {sale.productosDistintos}
                    </td>
                    <td className="numeric">
                      {number.format(
                        Number(sale.unidadesProducto || 0)
                      )}
                    </td>

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
                      <td className="numeric">
                        {currency.format(
                          Number(sale.totalBruto || 0)
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            <Pagination data={pagination} onChange={setPage} />
          </details>
        )}
      </section>
    </div>
  );
}

export default Ventas;
