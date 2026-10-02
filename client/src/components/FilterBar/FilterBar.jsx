import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  Store,
  UserRound,
  Sofa,
  ChevronDown,
  Search,
  X,
} from "lucide-react";

import {
  searchProductCodes,
  searchSellerNames,
} from "../../services/api";

const filters = {
  tienda: {
    label: "Tienda",
    icon: Store,
    options: [
      { value: "", label: "Todas las tiendas" },
    ],
  },
  vendedor: {
    label: "Vendedor",
    icon: UserRound,
    options: [
      { value: "", label: "Todos los vendedores" },
    ],
  },
};

const defaultFilterKeys = [
  "periodo",
  "tienda",
  "vendedor",
  "producto",
];

function formatDate(value) {
  const match = String(value ?? "").match(
    /^(\d{4})-(\d{2})-(\d{2})$/
  );

  if (!match) return value || "";

  return `${match[3]}/${match[2]}/${match[1]}`;
}

function formatMonth(value) {
  const match = String(value ?? "").match(/^(\d{4})-(\d{2})$/);

  if (!match) return value || "";

  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, 1)
  );

  const month = new Intl.DateTimeFormat("es-CL", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);

  return month.charAt(0).toUpperCase() + month.slice(1);
}

function minDate(a, b) {
  if (!a) return b;
  if (!b) return a;
  return a < b ? a : b;
}

function maxDate(a, b) {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

function clampDate(value, min, max) {
  if (!value) return value;
  if (min && value < min) return min;
  if (max && value > max) return max;
  return value;
}

function monthEnd(monthValue) {
  const match = String(monthValue ?? "").match(/^(\d{4})-(\d{2})$/);

  if (!match) return "";

  const year = Number(match[1]);
  const month = Number(match[2]);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();

  return `${match[1]}-${match[2]}-${String(lastDay).padStart(2, "0")}`;
}

function useOutsideClose(ref, open, close) {
  useEffect(() => {
    if (!open) return undefined;

    function handlePointerDown(event) {
      if (!ref.current?.contains(event.target)) {
        close();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [ref, open, close]);
}

function PeriodFilter({
  value = {},
  periodRange,
  onChange,
  loading,
}) {
  const containerRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("year");
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const [day, setDay] = useState("");
  const [draftFrom, setDraftFrom] = useState("");
  const [draftTo, setDraftTo] = useState("");
  const [error, setError] = useState("");

  useOutsideClose(containerRef, open, () => setOpen(false));

  const minAvailable = periodRange?.desde ?? "";
  const maxAvailable = periodRange?.hasta ?? "";
  const currentFrom = value?.desde ?? "";
  const currentTo = value?.hasta ?? "";

  useEffect(() => {
    const fallback = currentTo || currentFrom || maxAvailable || minAvailable;

    if (fallback) {
      setYear(fallback.slice(0, 4));
      setMonth(fallback.slice(0, 7));
      setDay(fallback);
    }

    setDraftFrom(currentFrom || minAvailable);
    setDraftTo(currentTo || maxAvailable);
  }, [
    currentFrom,
    currentTo,
    minAvailable,
    maxAvailable,
  ]);

  const years = useMemo(() => {
    const first = Number(minAvailable.slice(0, 4));
    const last = Number(maxAvailable.slice(0, 4));

    if (!first || !last) return [];

    return Array.from(
      { length: last - first + 1 },
      (_, index) => String(last - index)
    );
  }, [minAvailable, maxAvailable]);

  const visibleLabel = useMemo(() => {
    if (!currentFrom && !currentTo) {
      return minAvailable && maxAvailable
        ? `Todo: ${formatDate(minAvailable)} - ${formatDate(maxAvailable)}`
        : "Período";
    }

    if (currentFrom && currentFrom === currentTo) {
      return formatDate(currentFrom);
    }

    if (currentFrom && currentTo) {
      const yearValue = currentFrom.slice(0, 4);
      const expectedYearFrom = maxDate(
        `${yearValue}-01-01`,
        minAvailable
      );
      const expectedYearTo = minDate(
        `${yearValue}-12-31`,
        maxAvailable
      );

      if (
        currentFrom === expectedYearFrom &&
        currentTo === expectedYearTo
      ) {
        return yearValue;
      }

      const monthValue = currentFrom.slice(0, 7);
      const expectedMonthFrom = maxDate(
        `${monthValue}-01`,
        minAvailable
      );
      const expectedMonthTo = minDate(
        monthEnd(monthValue),
        maxAvailable
      );

      if (
        currentFrom === expectedMonthFrom &&
        currentTo === expectedMonthTo
      ) {
        return formatMonth(monthValue);
      }

      return `${formatDate(currentFrom)} - ${formatDate(currentTo)}`;
    }

    return currentFrom
      ? `Desde ${formatDate(currentFrom)}`
      : `Hasta ${formatDate(currentTo)}`;
  }, [
    currentFrom,
    currentTo,
    minAvailable,
    maxAvailable,
  ]);

  function applyRange(from, to) {
    const nextFrom = clampDate(from, minAvailable, maxAvailable);
    const nextTo = clampDate(to, minAvailable, maxAvailable);

    if (nextFrom && nextTo && nextFrom > nextTo) {
      setError("La fecha desde no puede ser posterior a la fecha hasta.");
      return;
    }

    setError("");
    onChange?.("periodo", {
      desde: nextFrom || "",
      hasta: nextTo || "",
    });
    setOpen(false);
  }

  function applyYear() {
    if (!year) return;

    applyRange(
      maxDate(`${year}-01-01`, minAvailable),
      minDate(`${year}-12-31`, maxAvailable)
    );
  }

  function applyMonth() {
    if (!month) return;

    applyRange(
      maxDate(`${month}-01`, minAvailable),
      minDate(monthEnd(month), maxAvailable)
    );
  }

  function applyDay() {
    if (!day) return;
    const selected = clampDate(day, minAvailable, maxAvailable);
    applyRange(selected, selected);
  }

  const tabs = [
    ["year", "Año"],
    ["month", "Mes"],
    ["day", "Día"],
    ["range", "Rango"],
  ];

  return (
    <div className="filter-popover-anchor" ref={containerRef}>
      <button
        type="button"
        className="filter-pill filter-pill-button"
        disabled={loading}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <CalendarDays
          className="filter-pill-icon"
          size={15}
          strokeWidth={1.9}
          aria-hidden="true"
        />
        <span className="filter-pill-value">
          {loading ? "Cargando..." : visibleLabel}
        </span>
        <ChevronDown
          className="filter-pill-chevron"
          size={14}
          strokeWidth={1.8}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className="filter-popover period-popover">
          <div className="filter-popover-heading">
            <div>
              <strong>Período</strong>
              <span>Elige el nivel de detalle que necesitas.</span>
            </div>
            <button
              type="button"
              className="filter-clear-button"
              onClick={() => applyRange("", "")}
            >
              Todo
            </button>
          </div>

          <div className="period-mode-tabs">
            {tabs.map(([key, label]) => (
              <button
                type="button"
                key={key}
                className={mode === key ? "active" : ""}
                onClick={() => {
                  setMode(key);
                  setError("");
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {mode === "year" && (
            <div className="period-editor">
              <label>
                Año
                <select
                  value={year}
                  onChange={(event) => setYear(event.target.value)}
                >
                  {years.map((item) => (
                    <option value={item} key={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="filter-apply-button"
                onClick={applyYear}
              >
                Aplicar
              </button>
            </div>
          )}

          {mode === "month" && (
            <div className="period-editor">
              <label>
                Mes
                <input
                  type="month"
                  value={month}
                  min={minAvailable ? minAvailable.slice(0, 7) : undefined}
                  max={maxAvailable ? maxAvailable.slice(0, 7) : undefined}
                  onChange={(event) => setMonth(event.target.value)}
                />
              </label>
              <button
                type="button"
                className="filter-apply-button"
                onClick={applyMonth}
              >
                Aplicar
              </button>
            </div>
          )}

          {mode === "day" && (
            <div className="period-editor">
              <label>
                Día
                <input
                  type="date"
                  value={day}
                  min={minAvailable || undefined}
                  max={maxAvailable || undefined}
                  onChange={(event) => setDay(event.target.value)}
                />
              </label>
              <button
                type="button"
                className="filter-apply-button"
                onClick={applyDay}
              >
                Aplicar
              </button>
            </div>
          )}

          {mode === "range" && (
            <div className="period-range-editor">
              <label>
                Desde
                <input
                  type="date"
                  value={draftFrom}
                  min={minAvailable || undefined}
                  max={maxAvailable || undefined}
                  onChange={(event) => setDraftFrom(event.target.value)}
                />
              </label>

              <label>
                Hasta
                <input
                  type="date"
                  value={draftTo}
                  min={minAvailable || undefined}
                  max={maxAvailable || undefined}
                  onChange={(event) => setDraftTo(event.target.value)}
                />
              </label>

              <button
                type="button"
                className="filter-apply-button"
                onClick={() => applyRange(draftFrom, draftTo)}
              >
                Aplicar rango
              </button>
            </div>
          )}

          {error && <div className="filter-inline-error">{error}</div>}
        </div>
      )}
    </div>
  );
}

function ProductFilter({
  value = [],
  onChange,
  loading,
}) {
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  useOutsideClose(containerRef, open, () => setOpen(false));

  const selected = Array.isArray(value) ? value : [];
  const selectedKey = selected.join("|");

  useEffect(() => {
    if (!open) return undefined;

    const term = query.trim();

    if (term.length < 2) {
      setResults([]);
      setSearching(false);
      setSearchError("");
      return undefined;
    }

    let active = true;

    const timer = window.setTimeout(() => {
      setSearching(true);
      setSearchError("");

      searchProductCodes(term, 8)
        .then((response) => {
          if (!active) return;

          const selectedSet = new Set(
            selected.map((code) => String(code).toUpperCase())
          );

          const matches = (response.productos ?? []).filter(
            (product) =>
              !selectedSet.has(String(product.codigo).toUpperCase())
          );

          setResults(matches);
          setActiveIndex(0);
        })
        .catch((error) => {
          if (!active) return;
          setResults([]);
          setSearchError(error.message);
        })
        .finally(() => {
          if (active) setSearching(false);
        });
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [open, query, selectedKey]);

  useEffect(() => {
    if (open) {
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  function addProduct(product) {
    const code = String(product?.codigo ?? "").trim();

    if (!code) return;

    const exists = selected.some(
      (item) => String(item).toUpperCase() === code.toUpperCase()
    );

    if (!exists) {
      onChange?.("producto", [...selected, code]);
    }

    setQuery("");
    setResults([]);
    setActiveIndex(0);
    inputRef.current?.focus();
  }

  function removeProduct(code) {
    onChange?.(
      "producto",
      selected.filter((item) => item !== code)
    );
  }

  function handleKeyDown(event) {
    if (event.key === "ArrowDown" && results.length > 0) {
      event.preventDefault();
      setActiveIndex((current) =>
        Math.min(current + 1, results.length - 1)
      );
    }

    if (event.key === "ArrowUp" && results.length > 0) {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
    }

    if (event.key === "Enter" && results[activeIndex]) {
      event.preventDefault();
      addProduct(results[activeIndex]);
    }

    if (event.key === "Escape") {
      setOpen(false);
    }
  }

  const visibleLabel =
    selected.length === 0
      ? "Producto"
      : selected.length === 1
        ? selected[0]
        : `${selected.length} productos`;

  return (
    <div className="filter-popover-anchor" ref={containerRef}>
      <button
        type="button"
        className="filter-pill filter-pill-button"
        disabled={loading}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <Sofa
          className="filter-pill-icon"
          size={15}
          strokeWidth={1.9}
          aria-hidden="true"
        />
        <span className="filter-pill-value">{visibleLabel}</span>
        <ChevronDown
          className="filter-pill-chevron"
          size={14}
          strokeWidth={1.8}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className="filter-popover product-popover">
          <div className="filter-popover-heading">
            <div>
              <strong>Productos</strong>
              <span>Busca por una parte del código y agrega uno o varios.</span>
            </div>

            {selected.length > 0 && (
              <button
                type="button"
                className="filter-clear-button"
                onClick={() => onChange?.("producto", [])}
              >
                Limpiar
              </button>
            )}
          </div>

          {selected.length > 0 && (
            <div className="product-filter-chips">
              {selected.map((code) => (
                <span className="product-filter-chip" key={code}>
                  {code}
                  <button
                    type="button"
                    aria-label={`Quitar ${code}`}
                    onClick={() => removeProduct(code)}
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="product-search-box">
            <Search size={15} aria-hidden="true" />
            <input
              ref={inputRef}
              type="search"
              value={query}
              placeholder="Ej. 2430"
              autoComplete="off"
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>

          <div className="product-search-results">
            {query.trim().length < 2 && (
              <div className="product-search-hint">
                Escribe al menos 2 caracteres del código.
              </div>
            )}

            {query.trim().length >= 2 && searching && (
              <div className="product-search-hint">
                Buscando coincidencias...
              </div>
            )}

            {query.trim().length >= 2 &&
              !searching &&
              !searchError &&
              results.length === 0 && (
                <div className="product-search-hint">
                  No se encontraron códigos relacionados.
                </div>
              )}

            {searchError && (
              <div className="filter-inline-error">{searchError}</div>
            )}

            {!searching &&
              results.map((product, index) => (
                <button
                  type="button"
                  className={
                    index === activeIndex
                      ? "product-search-result active"
                      : "product-search-result"
                  }
                  key={product.codigo}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => addProduct(product)}
                >
                  <strong>{product.codigo}</strong>
                  <span>{product.descripcion}</span>
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SellerFilter({
  value = [],
  tienda = "",
  onChange,
  loading,
}) {
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  useOutsideClose(containerRef, open, () => setOpen(false));

  const selected = Array.isArray(value) ? value : [];
  const selectedKey = selected.join("|");

  useEffect(() => {
    if (!open) return undefined;

    const term = query.trim();

    if (term.length < 2) {
      setResults([]);
      setSearching(false);
      setSearchError("");
      return undefined;
    }

    let active = true;

    const timer = window.setTimeout(() => {
      setSearching(true);
      setSearchError("");

      searchSellerNames(term, {
        limit: 8,
        tienda: tienda || undefined,
      })
        .then((response) => {
          if (!active) return;

          const selectedSet = new Set(
            selected.map((name) => String(name).toUpperCase())
          );

          const matches = (response.vendedores ?? []).filter(
            (name) =>
              !selectedSet.has(String(name).toUpperCase())
          );

          setResults(matches);
          setActiveIndex(0);
        })
        .catch((error) => {
          if (!active) return;
          setResults([]);
          setSearchError(error.message);
        })
        .finally(() => {
          if (active) setSearching(false);
        });
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [open, query, selectedKey, tienda]);

  useEffect(() => {
    if (open) {
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  function addSeller(name) {
    const seller = String(name ?? "").trim();

    if (!seller) return;

    const exists = selected.some(
      (item) =>
        String(item).toUpperCase() === seller.toUpperCase()
    );

    if (!exists) {
      onChange?.("vendedor", [...selected, seller]);
    }

    setQuery("");
    setResults([]);
    setActiveIndex(0);
    inputRef.current?.focus();
  }

  function removeSeller(name) {
    onChange?.(
      "vendedor",
      selected.filter((item) => item !== name)
    );
  }

  function handleKeyDown(event) {
    if (event.key === "ArrowDown" && results.length > 0) {
      event.preventDefault();
      setActiveIndex((current) =>
        Math.min(current + 1, results.length - 1)
      );
    }

    if (event.key === "ArrowUp" && results.length > 0) {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
    }

    if (event.key === "Enter" && results[activeIndex]) {
      event.preventDefault();
      addSeller(results[activeIndex]);
    }

    if (event.key === "Escape") {
      setOpen(false);
    }
  }

  const visibleLabel =
    selected.length === 0
      ? "Vendedor"
      : selected.length === 1
        ? selected[0]
        : `${selected.length} vendedores`;

  return (
    <div className="filter-popover-anchor" ref={containerRef}>
      <button
        type="button"
        className="filter-pill filter-pill-button"
        disabled={loading}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <UserRound
          className="filter-pill-icon"
          size={15}
          strokeWidth={1.9}
          aria-hidden="true"
        />
        <span className="filter-pill-value">{visibleLabel}</span>
        <ChevronDown
          className="filter-pill-chevron"
          size={14}
          strokeWidth={1.8}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className="filter-popover product-popover">
          <div className="filter-popover-heading">
            <div>
              <strong>Vendedores</strong>
              <span>
                Busca por una parte del nombre
                {tienda ? ` dentro de ${tienda}` : ""}.
              </span>
            </div>

            {selected.length > 0 && (
              <button
                type="button"
                className="filter-clear-button"
                onClick={() => onChange?.("vendedor", [])}
              >
                Limpiar
              </button>
            )}
          </div>

          {selected.length > 0 && (
            <div className="product-filter-chips">
              {selected.map((name) => (
                <span className="product-filter-chip" key={name}>
                  {name}
                  <button
                    type="button"
                    aria-label={`Quitar ${name}`}
                    onClick={() => removeSeller(name)}
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="product-search-box">
            <Search size={15} aria-hidden="true" />
            <input
              ref={inputRef}
              type="search"
              value={query}
              placeholder="Ej. marc"
              autoComplete="off"
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>

          <div className="product-search-results">
            {query.trim().length < 2 && (
              <div className="product-search-hint">
                Escribe al menos 2 caracteres del nombre.
              </div>
            )}

            {query.trim().length >= 2 && searching && (
              <div className="product-search-hint">
                Buscando vendedores...
              </div>
            )}

            {query.trim().length >= 2 &&
              !searching &&
              !searchError &&
              results.length === 0 && (
                <div className="product-search-hint">
                  No se encontraron vendedores relacionados.
                </div>
              )}

            {searchError && (
              <div className="filter-inline-error">{searchError}</div>
            )}

            {!searching &&
              results.map((name, index) => (
                <button
                  type="button"
                  className={
                    index === activeIndex
                      ? "product-search-result active"
                      : "product-search-result"
                  }
                  key={name}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => addSeller(name)}
                >
                  <strong>{name}</strong>
                  <span>{tienda || "Vendedor disponible"}</span>
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SelectFilter({
  filterKey,
  label,
  Icon,
  options,
  value,
  onChange,
  loading,
}) {
  const selectedOption = options.find(
    (option) => String(option.value) === String(value)
  );

  const visibleLabel =
    selectedOption?.label ??
    (loading ? "Cargando..." : label);

  return (
    <label className="filter-pill">
      <Icon
        className="filter-pill-icon"
        size={15}
        strokeWidth={1.9}
        aria-hidden="true"
      />

      <span className="filter-pill-value">
        {visibleLabel}
      </span>

      <ChevronDown
        className="filter-pill-chevron"
        size={14}
        strokeWidth={1.8}
        aria-hidden="true"
      />

      <select
        className="filter-pill-select"
        value={value ?? ""}
        aria-label={label}
        disabled={loading}
        onChange={(event) => {
          onChange?.(filterKey, event.target.value);
        }}
      >
        {options.length === 0 && (
          <option value="">
            {loading ? "Cargando..." : label}
          </option>
        )}

        {options.map((option) => (
          <option
            value={option.value}
            key={`${filterKey}-${option.value}`}
          >
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function FilterBar({
  visibleFilters = defaultFilterKeys,
  options = {},
  values = {},
  periodRange = null,
  onChange,
  loading = false,
}) {
  if (visibleFilters.length === 0) return null;

  return (
    <div
      className="filter-bar"
      aria-label="Filtros comerciales"
      aria-busy={loading}
    >
      {visibleFilters.map((key) => {
        if (key === "periodo") {
          return (
            <PeriodFilter
              key={key}
              value={values.periodo}
              periodRange={periodRange}
              onChange={onChange}
              loading={loading}
            />
          );
        }

        if (key === "producto") {
          return (
            <ProductFilter
              key={key}
              value={values.producto}
              onChange={onChange}
              loading={loading}
            />
          );
        }

        if (key === "vendedor") {
          return (
            <SellerFilter
              key={key}
              value={values.vendedor}
              tienda={values.tienda}
              onChange={onChange}
              loading={loading}
            />
          );
        }

        const filter = filters[key];

        if (!filter) return null;

        return (
          <SelectFilter
            key={key}
            filterKey={key}
            label={filter.label}
            Icon={filter.icon}
            options={options[key] ?? filter.options ?? []}
            value={values[key] ?? ""}
            onChange={onChange}
            loading={loading}
          />
        );
      })}
    </div>
  );
}

export default FilterBar;
