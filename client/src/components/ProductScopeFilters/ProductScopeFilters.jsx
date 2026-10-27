import { useEffect, useId, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { getAnalyticsFilters, searchProductCodes } from "../../services/api";
import "./ProductScopeFilters.css";

// Comparte filtros entre Cotizaciones, Ventas, Productos y Rendimiento.
// CodigoAshley es un identificador, no una segunda categoría comercial.
function ProductScopeFilters() {
  const [params, setParams] = useSearchParams();
  const [categories, setCategories] = useState([]);
  const [draft, setDraft] = useState(params.get("codigoAshley") || "");
  const [suggestions, setSuggestions] = useState([]);
  const [error, setError] = useState("");
  const categoryId = useId();
  const ashleyId = useId();
  const listId = useId();
  const category = params.get("categoriaGeneral") || "";
  const ashley = params.get("codigoAshley") || "";

  useEffect(() => {
    let active = true;
    getAnalyticsFilters()
      .then((response) => {
        if (active) setCategories(response.categoriasGenerales ?? []);
      })
      .catch(() => { if (active) setError("No fue posible cargar las categorías."); });
    return () => { active = false; };
  }, []);

  useEffect(() => { setDraft(ashley); }, [ashley]);

  useEffect(() => {
    if (draft.trim().length < 2 || draft.trim() === ashley) {
      setSuggestions([]);
      return;
    }

    let active = true;
    const timer = setTimeout(() => {
      searchProductCodes(draft.trim(), 10)
        .then((data) => {
          if (active) {
            setSuggestions(
              [...new Set((data.productos ?? []).map((p) => p.codigoAshley).filter(Boolean))]
            );
          }
        })
        .catch(() => { if (active) setSuggestions([]); });
    }, 250);

    return () => { active = false; clearTimeout(timer); };
  }, [draft, ashley]);

  function update(key, value) {
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (value) next.set(key, value);
      else next.delete(key);
      return next;
    });
  }

  return (
    <section className="product-scope" aria-label="Filtrar productos por categoría o código Ashley">
      <div className="product-scope-control">
        <label htmlFor={categoryId}>Categoría general</label>
        <select
          id={categoryId}
          value={category}
          onChange={(event) => update("categoriaGeneral", event.target.value)}
        >
          <option value="">Todas las categorías</option>
          {categories.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </div>

      <form className="product-scope-control" onSubmit={(event) => {
        event.preventDefault();
        update("codigoAshley", draft.trim());
      }}>
        <label htmlFor={ashleyId}>Código Ashley</label>
        <div className="product-scope-search">
          <input
            id={ashleyId}
            list={listId}
            value={draft}
            placeholder="Buscar código Ashley"
            onChange={(event) => setDraft(event.target.value)}
            autoComplete="off"
          />
          <datalist id={listId}>
            {suggestions.map((code) => <option key={code} value={code} />)}
          </datalist>
          <button type="submit">Aplicar</button>
        </div>
      </form>

      {(category || ashley) && (
        <button
          type="button"
          className="product-scope-clear"
          onClick={() => {
            setDraft("");
            setParams((current) => {
              const next = new URLSearchParams(current);
              next.delete("categoriaGeneral");
              next.delete("codigoAshley");
              return next;
            });
          }}
        >
          Limpiar filtros de categoría
        </button>
      )}
      {error && <small className="product-scope-error">{error}</small>}
    </section>
  );
}

export default ProductScopeFilters;
