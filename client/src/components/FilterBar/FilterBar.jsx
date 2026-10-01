import {
  CalendarDays,
  Store,
  UserRound,
  Sofa,
  ChevronDown,
} from "lucide-react";

const filters = {
  periodo: {
    label: "Período",
    icon: CalendarDays,
    options: [
      { value: "30", label: "Últimos 30 días" },
      { value: "90", label: "Últimos 90 días" },
      { value: "year", label: "Año actual" },
    ],
  },
  tienda: {
    label: "Tienda",
    icon: Store,
    options: [
      { value: "Antofagasta", label: "Antofagasta" },
      { value: "Todas", label: "Todas" },
    ],
  },
  vendedor: {
    label: "Vendedor",
    icon: UserRound,
    options: [{ value: "Todos", label: "Todos" }],
  },
  producto: {
    label: "Producto",
    icon: Sofa,
    options: [{ value: "Todos", label: "Todos" }],
  },
};

const defaultFilterKeys = [
  "periodo",
  "tienda",
  "vendedor",
  "producto",
];

function FilterBar({
  visibleFilters = defaultFilterKeys,
  options = {},
  values = {},
  onChange,
  loading = false,
}) {
  const activeFilters = visibleFilters
    .map((key) => ({
      key,
      ...filters[key],
      options: options[key] ?? filters[key]?.options ?? [],
    }))
    .filter((filter) => filter.label);

  if (activeFilters.length === 0) return null;

  return (
    <div
      className="filter-bar"
      aria-label="Filtros comerciales"
      aria-busy={loading}
    >
      {activeFilters.map(
        ({ key, label, icon: Icon, options: filterOptions }) => (
          <label className="filter-pill" key={key}>
            <Icon
              className="filter-pill-icon"
              size={15}
              strokeWidth={1.9}
            />

            <select
              value={values[key] ?? ""}
              aria-label={label}
              disabled={loading}
              onChange={(event) => {
                onChange?.(key, event.target.value);
              }}
            >
              {filterOptions.length === 0 && (
                <option value="">
                  {loading ? "Cargando..." : label}
                </option>
              )}

              {filterOptions.map((option) => (
                <option value={option.value} key={`${key}-${option.value}`}>
                  {option.label}
                </option>
              ))}
            </select>

            <ChevronDown
              className="filter-pill-chevron"
              size={14}
              strokeWidth={1.8}
              aria-hidden="true"
            />
          </label>
        )
      )}
    </div>
  );
}

export default FilterBar;
