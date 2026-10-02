const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3001/api";

function buildQuery(filters = {}) {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== null && value !== undefined && String(value).trim() !== "") {
      params.set(key, String(value).trim());
    }
  });

  const query = params.toString();
  return query ? `?${query}` : "";
}

async function getJson(path, fallbackMessage) {
  const response = await fetch(`${API_URL}${path}`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || fallbackMessage);
  }

  return data;
}


export async function getSystemHealth() {
  const response = await fetch(`${API_URL}/health`);

  if (!response.ok) {
    throw new Error("No fue posible comprobar el estado de Micapp.");
  }

  return response.json();
}

export async function getKpiSummary(filters = {}) {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== null && value !== undefined && String(value).trim() !== "") {
      params.set(key, String(value).trim());
    }
  });

  const query = params.toString();
  const response = await fetch(
    `${API_URL}/kpis/resumen${query ? `?${query}` : ""}`
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || "No fue posible obtener los indicadores de Micapp."
    );
  }

  return data;
}

export async function getKpiEvolution(filters = {}) {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== null && value !== undefined && String(value).trim() !== "") {
      params.set(key, String(value).trim());
    }
  });

  const query = params.toString();
  const response = await fetch(
    `${API_URL}/kpis/evolucion${query ? `?${query}` : ""}`
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || "No fue posible obtener la evolución comercial."
    );
  }

  return data;
}

export async function getKpiFilters() {
  const response = await fetch(`${API_URL}/kpis/filtros`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || "No fue posible obtener los filtros disponibles."
    );
  }

  return data;
}


export function getAnalyticsFilters() {
  return getJson(
    "/analytics/filtros",
    "No fue posible obtener los filtros analíticos."
  );
}

export function searchProductCodes(query, limit = 8) {
  return getJson(
    "/analytics/productos/buscar" + buildQuery({ q: query, limit }),
    "No fue posible buscar productos."
  );
}

export function searchSellerNames(query, options = {}) {
  return getJson(
    "/analytics/vendedores/buscar" +
      buildQuery({
        q: query,
        limit: options.limit ?? 8,
        tienda: options.tienda,
      }),
    "No fue posible buscar vendedores."
  );
}

export function getProductAnalytics(filters = {}) {
  return getJson(
    `/analytics/productos${buildQuery(filters)}`,
    "No fue posible obtener el análisis de productos."
  );
}

export function getPerformanceAnalytics(filters = {}) {
  return getJson(
    `/analytics/rendimiento${buildQuery(filters)}`,
    "No fue posible obtener el análisis de rendimiento."
  );
}

export function getQuoteAnalytics(filters = {}) {
  return getJson(
    `/analytics/cotizaciones${buildQuery(filters)}`,
    "No fue posible obtener las cotizaciones."
  );
}

export function getSalesAnalytics(filters = {}) {
  return getJson(
    `/analytics/ventas${buildQuery(filters)}`,
    "No fue posible obtener las ventas."
  );
}

export async function importSapFile(file) {
  const formData = new FormData();
  formData.append("archivo", file);

  const response = await fetch(`${API_URL}/importaciones`, {
    method: "POST",
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "No fue posible importar el archivo.");
  }

  return data;
}

export { API_URL };
