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
    options: ["Últimos 30 días", "Últimos 90 días", "Año actual"],
  },
  tienda: {
    label: "Tienda",
    icon: Store,
    options: ["Antofagasta", "Todas"],
  },
  vendedor: {
    label: "Vendedor",
    icon: UserRound,
    options: ["Todos"],
  },
  producto: {
    label: "Producto",
    icon: Sofa,
    options: ["Todos"],
  },
};

const defaultFilterKeys = [
  "periodo",
  "tienda",
  "vendedor",
  "producto",
];

function FilterBar({ visibleFilters = defaultFilterKeys }) {
  const activeFilters = visibleFilters
    .map((key) => filters[key])
    .filter(Boolean);

  return (
    <div className="filter-bar" aria-label="Filtros comerciales">
      {activeFilters.map(({ label, icon: Icon, options }) => (
        <label className="filter-pill" key={label}>
          <Icon className="filter-pill-icon" size={15} strokeWidth={1.9} />

          <select defaultValue="" aria-label={label}>
            <option value="" disabled>
              {label}
            </option>

            {options.map((option) => (
              <option value={option} key={option}>
                {option}
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
      ))}
    </div>
  );
}

export default FilterBar;
