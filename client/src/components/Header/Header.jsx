import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { LogOut } from "lucide-react";

import FilterBar from "../FilterBar/FilterBar";
import { getAnalyticsFilters, logoutSession } from "../../services/api";

function filtersForPath(pathname) {
  if (pathname === "/") return ["periodo", "tienda"];
  if (pathname === "/productos") return ["periodo", "tienda", "producto"];
  if (pathname === "/tiendas") return ["periodo", "tienda", "vendedor"];
  if (pathname === "/cotizaciones" || pathname === "/ventas") {
    return ["periodo", "tienda", "vendedor", "producto"];
  }

  return [];
}

function parseList(value) {
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
  const dashboardDefaultApplied = useRef(false);

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

  useEffect(() => {
    if (location.pathname !== "/") {
      dashboardDefaultApplied.current = false;
      return;
    }

    if (dashboardDefaultApplied.current) return;

    const alreadyHasPeriod =
      searchParams.get("desde") ||
      searchParams.get("hasta") ||
      searchParams.get("fecha");

    if (alreadyHasPeriod) {
      dashboardDefaultApplied.current = true;
      return;
    }

    const maxAvailable = filterData?.periodoDisponible?.hasta;
    const minAvailable = filterData?.periodoDisponible?.desde;

    if (!maxAvailable) return;

    const monthStart = `${maxAvailable.slice(0, 7)}-01`;
    const from =
      minAvailable && minAvailable > monthStart
        ? minAvailable
        : monthStart;

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("desde", from);
    nextParams.set("hasta", maxAvailable);

    dashboardDefaultApplied.current = true;
    setSearchParams(nextParams, { replace: true });
  }, [
    filterData,
    location.pathname,
    searchParams,
    setSearchParams,
  ]);

  const options = useMemo(() => {
    if (!filterData) {
      return {
        tienda: [],
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
    };
  }, [filterData]);

  const legacyDate = searchParams.get("fecha") ?? "";
  const legacyProduct = searchParams.get("producto") ?? "";
  const legacySeller = searchParams.get("vendedor") ?? "";

  const values = {
    periodo: {
      desde: searchParams.get("desde") ?? legacyDate,
      hasta: searchParams.get("hasta") ?? legacyDate,
    },
    tienda: searchParams.get("tienda") ?? "",
    vendedor: parseList(
      searchParams.get("vendedores") ?? legacySeller
    ),
    producto: parseList(
      searchParams.get("productos") ?? legacyProduct
    ),
  };

  async function handleLogout() {
    try {
      await logoutSession();
    } catch (error) {
      console.error("No fue posible cerrar la sesión:", error);
    } finally {
      window.location.assign("/login");
    }
  }

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

    if (key === "vendedor") {
      const sellers = Array.isArray(value) ? value : [];
      nextParams.delete("vendedor");

      if (sellers.length > 0) {
        nextParams.set("vendedores", sellers.join(","));
      } else {
        nextParams.delete("vendedores");
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

      <div className="topbar-actions">
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

        <button
          type="button"
          className="logout-button"
          onClick={handleLogout}
          title="Cerrar sesión"
          aria-label="Cerrar sesión"
        >
          <LogOut size={16} strokeWidth={1.9} />
          <span>Cerrar sesión</span>
        </button>
      </div>
    </header>
  );
}

export default Header;
