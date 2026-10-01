import { useEffect, useMemo, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";

import FilterBar from "../FilterBar/FilterBar";
import { getAnalyticsFilters } from "../../services/api";

function formatDateLabel(value) {
  if (!value) return null;

  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) return value;

  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}

function filtersForPath(pathname) {
  if (pathname === "/") return ["periodo", "tienda"];
  if (pathname === "/productos") return ["periodo", "tienda", "producto"];
  if (pathname === "/tiendas") return ["periodo", "tienda", "vendedor"];
  if (pathname === "/cotizaciones" || pathname === "/ventas") {
    return ["periodo", "tienda", "vendedor", "producto"];
  }

  return [];
}

function Header() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filterData, setFilterData] = useState(null);
  const [loading, setLoading] = useState(false);

  const visibleFilters = filtersForPath(location.pathname);

  useEffect(() => {
    if (visibleFilters.length === 0) return undefined;

    let active = true;
    setLoading(true);

    getAnalyticsFilters()
      .then((data) => {
        if (active) setFilterData(data);
      })
      .catch((error) => {
        console.error("No fue posible cargar filtros analíticos:", error);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [location.pathname]);

  const options = useMemo(() => {
    if (!filterData) {
      return {
        periodo: [],
        tienda: [],
        vendedor: [],
        producto: [],
      };
    }

    const from = formatDateLabel(filterData.periodoDisponible?.desde);
    const to = formatDateLabel(filterData.periodoDisponible?.hasta);

    const rangeLabel =
      from && to
        ? from === to
          ? `Todo: ${from}`
          : `Todo: ${from} - ${to}`
        : "Todo el período";

    return {
      periodo: [
        { value: "", label: rangeLabel },
        ...(filterData.fechas ?? []).map((date) => ({
          value: date,
          label: formatDateLabel(date),
        })),
      ],
      tienda: [
        { value: "", label: "Todas las tiendas" },
        ...(filterData.tiendas ?? []).map((store) => ({
          value: store,
          label: store,
        })),
      ],
      vendedor: [
        { value: "", label: "Todos los vendedores" },
        ...(filterData.vendedores ?? []).map((seller) => ({
          value: seller,
          label: seller,
        })),
      ],
      producto: [
        { value: "", label: "Todos los productos" },
        ...(filterData.productos ?? []).map((product) => ({
          value: product.codigo,
          label:
            product.descripcion && product.descripcion !== product.codigo
              ? `${product.codigo} · ${product.descripcion}`
              : product.codigo,
        })),
      ],
    };
  }, [filterData]);

  const values = {
    periodo: searchParams.get("fecha") ?? "",
    tienda: searchParams.get("tienda") ?? "",
    vendedor: searchParams.get("vendedor") ?? "",
    producto: searchParams.get("producto") ?? "",
  };

  function handleChange(key, value) {
    const nextParams = new URLSearchParams(searchParams);
    const paramName = key === "periodo" ? "fecha" : key;

    if (value) {
      nextParams.set(paramName, value);
    } else {
      nextParams.delete(paramName);
    }

    setSearchParams(nextParams);
  }

  return (
    <header className="topbar">
      <div className="topbar-heading">
        <h1>Store Manager</h1>
        <p>Version 1.0 - Prueba</p>
      </div>

      {visibleFilters.length > 0 && (
        <FilterBar
          visibleFilters={visibleFilters}
          options={options}
          values={values}
          onChange={handleChange}
          loading={loading}
        />
      )}
    </header>
  );
}

export default Header;
