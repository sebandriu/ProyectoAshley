import { useEffect, useId, useState } from "react";
import { useSearchParams } from "react-router-dom";

import {
  getAnalyticsFilters,
  getAshleyCodeOptions,
} from "../../services/api";
import "./ProductScopeFilters.css";

// Filtros comunes de Cotizaciones, Ventas, Productos y Tiendas/Vendedores.
// Las dos listas provienen de PostgreSQL, sin introducir códigos manuales.
function ProductScopeFilters() {
  const [params, setParams] = useSearchParams();
  const [categories, setCategories] = useState([]);
  const [codes, setCodes] = useState([]);
  const [codeLoading, setCodeLoading] = useState(true);
  const [error, setError] = useState("");
  const categoryId = useId();
  const ashleyId = useId();
  const category = params.get("categoriaGeneral") || "";
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
    setError("");

    getAshleyCodeOptions(category)
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
  }, [category]);

  function update(key, value) {
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (value) next.set(key, value);
      else next.delete(key);

      // El código elegido en otra categoría ya no es una selección válida.
      if (key === "categoriaGeneral") next.delete("codigoAshley");
      return next;
    });
  }

  const selectedCodeNotListed =
    !codeLoading && ashley &&
    !codes.some((item) => item.codigo === ashley);

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
          {categories.map((item) => (
            <option value={item} key={item}>{item}</option>
          ))}
        </select>
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
            <option value={ashley}>{ashley} (no disponible en esta categoría)</option>
          )}
          {codes.map((item) => (
            <option value={item.codigo} key={item.codigo}>
              {item.codigo}{item.descripcion ? ` · ${item.descripcion.slice(0, 65)}` : ""}
            </option>
          ))}
        </select>
      </div>

      {(category || ashley) && (
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
