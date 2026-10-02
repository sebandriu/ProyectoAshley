import { useEffect, useMemo, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";

import FilterBar from "../FilterBar/FilterBar";
import { getAnalyticsFilters } from "../../services/api";

function filtersForPath(pathname) {
  if (pathname === "/") return ["periodo", "tienda"];
  if (pathname === "/productos") return ["periodo", "tienda", "producto"];
  if (pathname === "/tiendas") return ["periodo", "tienda", "vendedor"];
  if (pathname === "/cotizaciones" || pathname === "/ventas") {
    return ["periodo", "tienda", "vendedor", "producto"];
  }

  return [];
}

function parseProducts(value) {
  return [
    ...new Set(
      String(value ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    ),
  ];
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
        tienda: [],
        vendedor: [],
      };
    }

    return {
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
    };
  }, [filterData]);

  const legacyDate = searchParams.get("fecha") ?? "";
  const legacyProduct = searchParams.get("producto") ?? "";

  const values = {
    periodo: {
      desde: searchParams.get("desde") ?? legacyDate,
      hasta: searchParams.get("hasta") ?? legacyDate,
    },
    tienda: searchParams.get("tienda") ?? "",
    vendedor: searchParams.get("vendedor") ?? "",
    producto: parseProducts(
      searchParams.get("productos") ?? legacyProduct
    ),
  };

  function handleChange(key, value) {
    const nextParams = new URLSearchParams(searchParams);

    if (key === "periodo") {
      nextParams.delete("fecha");

      if (value?.desde) {
        nextParams.set("desde", value.desde);
      } else {
        nextParams.delete("desde");
      }

      if (value?.hasta) {
        nextParams.set("hasta", value.hasta);
      } else {
        nextParams.delete("hasta");
      }

      setSearchParams(nextParams);
      return;
    }

    if (key === "producto") {
      const products = Array.isArray(value) ? value : [];
      nextParams.delete("producto");

      if (products.length > 0) {
        nextParams.set("productos", products.join(","));
      } else {
        nextParams.delete("productos");
      }

      setSearchParams(nextParams);
      return;
    }

    if (value) {
      nextParams.set(key, value);
    } else {
      nextParams.delete(key);
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
          periodRange={filterData?.periodoDisponible ?? null}
          onChange={handleChange}
          loading={loading}
        />
      )}
    </header>
  );
}

export default Header;
