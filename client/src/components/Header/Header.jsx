import { useEffect, useMemo, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";

import FilterBar from "../FilterBar/FilterBar";
import { getKpiFilters } from "../../services/api";

function formatDateLabel(value) {
  if (!value) return null;

  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) return value;

  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}

function Header() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const isDashboard = location.pathname === "/";

  const [dashboardFilters, setDashboardFilters] = useState(null);
  const [dashboardFiltersLoading, setDashboardFiltersLoading] =
    useState(false);

  const [localValues, setLocalValues] = useState({
    periodo: "",
    tienda: "",
    vendedor: "",
    producto: "",
  });

  useEffect(() => {
    if (!isDashboard) return undefined;

    let active = true;
    setDashboardFiltersLoading(true);

    getKpiFilters()
      .then((data) => {
        if (active) {
          setDashboardFilters(data);
        }
      })
      .catch((error) => {
        console.error("No fue posible cargar filtros del Dashboard:", error);
      })
      .finally(() => {
        if (active) {
          setDashboardFiltersLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [isDashboard]);

  const dashboardOptions = useMemo(() => {
    if (!dashboardFilters) {
      return {
        periodo: [],
        tienda: [],
      };
    }

    const from = formatDateLabel(
      dashboardFilters.periodoDisponible?.desde
    );
    const to = formatDateLabel(
      dashboardFilters.periodoDisponible?.hasta
    );

    const rangeLabel =
      from && to
        ? from === to
          ? `Todo: ${from}`
          : `Todo: ${from} - ${to}`
        : "Todo el período";

    return {
      periodo: [
        {
          value: "",
          label: rangeLabel,
        },
        ...(dashboardFilters.fechas ?? []).map((date) => ({
          value: date,
          label: formatDateLabel(date),
        })),
      ],
      tienda: [
        {
          value: "",
          label: "Todas",
        },
        ...(dashboardFilters.tiendas ?? []).map((store) => ({
          value: store,
          label: store,
        })),
      ],
    };
  }, [dashboardFilters]);

  const dashboardValues = {
    periodo: searchParams.get("fecha") ?? "",
    tienda: searchParams.get("tienda") ?? "",
  };

  function handleDashboardChange(key, value) {
    const nextParams = new URLSearchParams(searchParams);

    if (key === "periodo") {
      if (value) {
        nextParams.set("fecha", value);
      } else {
        nextParams.delete("fecha");
      }
    }

    if (key === "tienda") {
      if (value) {
        nextParams.set("tienda", value);
      } else {
        nextParams.delete("tienda");
      }
    }

    setSearchParams(nextParams);
  }

  function handleLocalChange(key, value) {
    setLocalValues((current) => ({
      ...current,
      [key]: value,
    }));
  }

  return (
    <header className="topbar">
      <div className="topbar-heading">
        <h1>Store Manager</h1>
        <p>Version 1.0 - Prueba</p>
      </div>

      {isDashboard ? (
        <FilterBar
          visibleFilters={["periodo", "tienda"]}
          options={dashboardOptions}
          values={dashboardValues}
          onChange={handleDashboardChange}
          loading={dashboardFiltersLoading}
        />
      ) : (
        <FilterBar
          visibleFilters={[
            "periodo",
            "tienda",
            "vendedor",
            "producto",
          ]}
          values={localValues}
          onChange={handleLocalChange}
        />
      )}
    </header>
  );
}

export default Header;
