import { useEffect, useId, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { getAnalyticsFilters, getAshleyCodeOptions } from "../../services/api";
import "./ProductScopeFilters.css";

// Conserva compatibilidad con enlaces de una categoría y acepta varias.
// JSON evita confundir las comas que puedan formar parte del nombre.
function parseCategories(value) {
  if (!value) return [];
  if (value.startsWith("[")) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Nombre literal de categoría, no una lista.
    }
  }
  return [value];
}

function ProductScopeFilters() {
  const [params, setParams] = useSearchParams();
  const [categories, setCategories] = useState([]);
  const [codes, setCodes] = useState([]);
  const [codeLoading, setCodeLoading] = useState(true);
  const [error, setError] = useState("");
  const categoryId = useId();
  const ashleyId = useId();
  const categoryFilter = params.get("categoriaGeneral") || "";
  const selectedCategories = parseCategories(categoryFilter);
  const ashley = params.get("codigoAshley") || "";

  useEffect(() => {
    let active = true;
    getAnalyticsFilters()
      .then((response) => {
        if (active) setCategories(response.categoriasGenerales ?? []);
      })
      .catch(() => {
        if (active) setError("No fue posible cargar las categorías.");
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setCodeLoading(true);
    setCodes([]);

    getAshleyCodeOptions(categoryFilter)
      .then((response) => {
        if (active) setCodes(response.codigos ?? []);
      })
      .catch(() => {
        if (active) setError("No fue posible cargar los códigos Ashley.");
      })
      .finally(() => {
        if (active) setCodeLoading(false);
      });

    return () => { active = false; };
  }, [categoryFilter]);

  function update(key, value) {
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (value) next.set(key, value);
      else next.delete(key);
      if (key === "categoriaGeneral") next.delete("codigoAshley");
      return next;
    });
  }

  function toggleCategory(category) {
    const next = selectedCategories.includes(category)
      ? selectedCategories.filter((item) => item !== category)
      : [...selectedCategories, category];
    update("categoriaGeneral", next.length > 1
      ? JSON.stringify(next)
      : next[0] || "");
  }

  const categoryLabel = selectedCategories.length === 0
    ? "Todas las categorías"
    : selectedCategories.length === 1
      ? selectedCategories[0]
      : `${selectedCategories.length} categorías seleccionadas`;

  const selectedCodeNotListed =
    !codeLoading && ashley &&
    !codes.some((item) => item.codigo === ashley);

  return (
    <section className="product-scope" aria-label="Filtros de productos y categorías">
      <div className="product-scope-control">
        <span className="product-scope-label" id={categoryId}>Categoría general</span>
        <details className="product-scope-picker">
          <summary aria-labelledby={categoryId} title={categoryLabel}>
            <span>{categoryLabel}</span>
          </summary>
          <div className="product-scope-options" role="group" aria-label="Elegir categorías generales">
            {selectedCategories.length > 0 && (
              <button type="button" className="product-scope-reset" onClick={() => update("categoriaGeneral", "")}>
                Todas las categorías (limpiar selección)
              </button>
            )}
            {categories.map((category) => (
              <label key={category} className="product-scope-option">
                <input
                  type="checkbox"
                  checked={selectedCategories.includes(category)}
                  onChange={() => toggleCategory(category)}
                />
                <span>{category}</span>
              </label>
            ))}
            {!categories.length && <p className="product-scope-empty">Sin categorías disponibles.</p>}
          </div>
        </details>
      </div>

      <div className="product-scope-control">
        <label htmlFor={ashleyId}>Código Ashley</label>
        <select
          id={ashleyId}
          value={ashley}
          onChange={(event) => update("codigoAshley", event.target.value)}
          disabled={codeLoading}
        >
          <option value="">
            {codeLoading ? "Cargando códigos Ashley..." : "Todos los códigos Ashley"}
          </option>
          {selectedCodeNotListed && (
            <option value={ashley}>{ashley} (no disponible)</option>
          )}
          {codes.map((item) => (
            <option value={item.codigo} key={item.codigo}>
              {item.codigo}{item.descripcion ? ` · ${item.descripcion.slice(0, 65)}` : ""}
            </option>
          ))}
        </select>
      </div>

      {(selectedCategories.length > 0 || ashley) && (
        <button
          type="button"
          className="product-scope-clear"
          onClick={() => {
            setParams((current) => {
              const next = new URLSearchParams(current);
              next.delete("categoriaGeneral");
              next.delete("codigoAshley");
              return next;
            });
          }}
        >
          Limpiar filtros de categoría y código
        </button>
      )}
      {error && <small className="product-scope-error" role="status">{error}</small>}
    </section>
  );
}

export default ProductScopeFilters;
