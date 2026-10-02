import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { getProductAnalytics } from "../../services/api";

const number = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 2 });
const currency = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

function compareValues(a, b, direction) {
  const aMissing = a === null || a === undefined || a === "";
  const bMissing = b === null || b === undefined || b === "";

  if (aMissing && bMissing) return 0;
  if (aMissing) return 1;
  if (bMissing) return -1;

  const numericA = Number(a);
  const numericB = Number(b);
  const bothNumeric =
    Number.isFinite(numericA) &&
    Number.isFinite(numericB) &&
    typeof a !== "string" &&
    typeof b !== "string";

  let result;

  if (bothNumeric) {
    result = numericA - numericB;
  } else {
    result = String(a).localeCompare(String(b), "es", {
      numeric: true,
      sensitivity: "base",
    });
  }

  return direction === "asc" ? result : -result;
}

function SortableHeader({
  label,
  sortKey,
  sort,
  onSort,
  numeric = false,
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
        onClick={() => onSort(sortKey, numeric)}
      >
        <span>{label}</span>
        <span className={active ? "sort-symbol active" : "sort-symbol"}>
          {symbol}
        </span>
      </button>
    </th>
  );
}

function Productos() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState("loading");
  const [data, setData] = useState({ resumen: {}, productos: [] });
  const [error, setError] = useState("");
  const [sort, setSort] = useState({
    key: "unidadesCotizadas",
    direction: "desc",
  });

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

  const products = useMemo(() => {
    const rows = [...(data.productos ?? [])];

    rows.sort((a, b) =>
      compareValues(a[sort.key], b[sort.key], sort.direction)
    );

    return rows;
  }, [data.productos, sort]);

  function handleSort(key, numericColumn) {
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
        direction: numericColumn ? "desc" : "asc",
      };
    });
  }

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
          <span>Conversión de unidades OF</span>
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
                  <SortableHeader
                    label="Código"
                    sortKey="codigo"
                    sort={sort}
                    onSort={handleSort}
                  />
                  <SortableHeader
                    label="Producto"
                    sortKey="descripcion"
                    sort={sort}
                    onSort={handleSort}
                  />
                  <SortableHeader
                    label="Cotizadas"
                    sortKey="unidadesCotizadas"
                    sort={sort}
                    onSort={handleSort}
                    numeric
                  />
                  <SortableHeader
                    label="Convertidas"
                    sortKey="unidadesConvertidas"
                    sort={sort}
                    onSort={handleSort}
                    numeric
                  />
                  <SortableHeader
                    label="No convertidas"
                    sortKey="demandaNoConvertida"
                    sort={sort}
                    onSort={handleSort}
                    numeric
                  />
                  <SortableHeader
                    label="Vendidas"
                    sortKey="unidadesVendidas"
                    sort={sort}
                    onSort={handleSort}
                    numeric
                  />
                  <SortableHeader
                    label="Conv. unidades OF"
                    sortKey="conversionUnidadesPct"
                    sort={sort}
                    onSort={handleSort}
                    numeric
                  />
                  <SortableHeader
                    label="Monto vendido"
                    sortKey="montoVendido"
                    sort={sort}
                    onSort={handleSort}
                    numeric
                  />
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
