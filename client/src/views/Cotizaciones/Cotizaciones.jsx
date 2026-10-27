import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { getQuoteAnalytics } from "../../services/api";
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

function formatMatches(matches) {
  if (!Array.isArray(matches) || matches.length === 0) {
    return "—";
  }

  return matches
    .map(
      (item) =>
        `${item.codigo} ×${number.format(Number(item.cantidad || 0))}`
    )
    .join(" · ");
}

function Cotizaciones() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState("loading");
  const [data, setData] = useState([]);
  const [summary, setSummary] = useState({
    total: 0,
    pendientes: 0,
    conVenta: 0,
    sinVenta: 0,
    monto: 0,
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

    getQuoteAnalytics(filters)
      .then((response) => {
        if (!active) return;
        setData(response.cotizaciones ?? []);
        setPagination(response.paginacion ?? null);
        setSummary(
          response.resumen ?? {
            total: 0,
            pendientes: 0,
            conVenta: 0,
            sinVenta: 0,
            monto: 0,
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

  const hasProductFilter = selectedProducts.length > 0 ||
    Boolean(filters.categoriaGeneral || filters.codigoAshley);
  const closurePct = summary.tasaCierrePct;
  const pendingShare = summary.total > 0
    ? (summary.pendientes / summary.total) * 100
    : 0;

  return (
    <div className="page">
      <ProductScopeFilters />
      <section className="module-summary-grid">
        <article className="summary-card">
          <span>Cotizaciones</span>
          <strong>{summary.total}</strong>
        </article>
        <article className="summary-card">
          <span>Conversión de OF resueltas</span>
          <strong>{closurePct == null ? "—" : `${number.format(closurePct)}%`}</strong>
        </article>
        <article className="summary-card">
          <span>Pendientes</span>
          <strong>{summary.pendientes}</strong>
        </article>
        <article className="summary-card">
          <span>{hasProductFilter ? "Monto de productos filtrados" : "Monto cotizado (OF completas)"}</span>
          <strong>{currency.format(Number(
            hasProductFilter ? summary.montoSeleccionado : summary.monto
          ) || 0)}</strong>
        </article>
      </section>

      {status === "success" && summary.total > 0 && (
        <p className="module-insight">
          <strong>{summary.pendientes} OF pendientes</strong> ({number.format(pendingShare)}% de las OF).
          {" "}{summary.conVenta} tienen venta y {summary.sinVenta} cerraron sin venta.
          {hasProductFilter && (
            <> El monto filtrado incluye solo líneas coincidentes; el total del documento se mantiene en el detalle.</>
          )}
        </p>
      )}

      <section className="panel module-panel">
        <header className="module-header">
          <div>
            <span className="panel-eyebrow">Detalle comercial</span>
            <h2>Cotizaciones</h2>
          </div>
          <span className="module-count">
            {pagination?.total ?? summary.total} encontradas
          </span>
        </header>

        {hasProductFilter && (
          <p className="module-subtitle">
            Se muestran las OF que contienen productos coincidentes. Las unidades y
            productos coincidentes corresponden al filtro; los totales de OF
            permanecen completos como referencia.
          </p>
        )}

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
          <details className="module-details">
            <summary>Ver documentos ({data.length} mostrados, máximo 500)</summary>
            <div className="table-scroll">
            <table className="analytics-table quotes-table">
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
                    label="N° OF"
                    sortKey="numero"
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
                    label="Productos OF"
                    sortKey="productos"
                    sort={sort}
                    onSort={handleSort}
                    numeric
                  />
                  <SortableHeader
                    label="Unidades OF"
                    sortKey="unidades"
                    sort={sort}
                    onSort={handleSort}
                    numeric
                  />
                  {hasProductFilter && (
                    <>
                      <SortableHeader
                        label="Coincidencias"
                        sortKey="coincidencias"
                        sort={sort}
                        onSort={handleSort}
                        numeric
                      />
                      <SortableHeader
                        label="Unid. coinc."
                        sortKey="unidadesCoincidentes"
                        sort={sort}
                        onSort={handleSort}
                        numeric
                      />
                    </>
                  )}
                  <SortableHeader
                    label="Total bruto"
                    sortKey="totalBruto"
                    sort={sort}
                    onSort={handleSort}
                    numeric
                  />
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
                    <td className="numeric">{quote.lineasProducto}</td>
                    <td className="numeric">
                      {number.format(Number(quote.unidadesProducto || 0))}
                    </td>
                    {hasProductFilter && (
                      <>
                        <td className="quote-matches">
                          {formatMatches(quote.productosCoincidentes)}
                        </td>
                        <td className="numeric">
                          {number.format(
                            Number(quote.unidadesCoincidentes || 0)
                          )}
                        </td>
                      </>
                    )}
                    <td className="numeric">
                      {currency.format(Number(quote.totalBruto || 0))}
                    </td>
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

export default Cotizaciones;
