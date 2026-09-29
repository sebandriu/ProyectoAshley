import {
  CalendarDays,
  Store,
  UserRound,
  Sofa,
  ChevronDown,
} from "lucide-react";

const filters = [
  {
    label: "Período",
    icon: CalendarDays,
    options: ["Últimos 30 días", "Últimos 90 días", "Año actual"],
  },
  {
    label: "Tienda",
    icon: Store,
    options: ["Antofagasta", "Todas"],
  },
  {
    label: "Vendedor",
    icon: UserRound,
    options: ["Todos"],
  },
  {
    label: "Producto",
    icon: Sofa,
    options: ["Todos"],
  },
];

function FilterBar() {
  return (
    <div className="filter-bar" aria-label="Filtros comerciales">
      {filters.map(({ label, icon: Icon, options }) => (
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
