const API_URL =
  import.meta.env.VITE_API_URL || "/api";

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

function notifyUnauthorized() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("micapp:unauthorized"));
  }
}

async function apiFetch(
  path,
  options = {},
  { redirectOnUnauthorized = true } = {}
) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
  });

  if (response.status === 401 && redirectOnUnauthorized) {
    notifyUnauthorized();
  }

  return response;
}

async function parseJson(response) {
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    return {};
  }

  return response.json();
}

async function getJson(path, fallbackMessage) {
  const response = await apiFetch(path);
  const data = await parseJson(response);

  if (!response.ok) {
    throw new Error(data.message || fallbackMessage);
  }

  return data;
}

export async function loginSession({ username, password }) {
  const response = await apiFetch(
    "/auth/login",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username,
        password,
      }),
    },
    { redirectOnUnauthorized: false }
  );

  const data = await parseJson(response);

  if (!response.ok) {
    throw new Error(
      data.message || "No fue posible iniciar sesión."
    );
  }

  return data;
}

export async function getCurrentSession() {
  const response = await apiFetch(
    "/auth/session",
    {},
    { redirectOnUnauthorized: false }
  );

  const data = await parseJson(response);

  if (response.status === 401) {
    return {
      authenticated: false,
      user: null,
    };
  }

  if (!response.ok) {
    throw new Error(
      data.message || "No fue posible comprobar la sesión."
    );
  }

  return data;
}

export async function logoutSession() {
  const response = await apiFetch(
    "/auth/logout",
    {
      method: "POST",
    },
    { redirectOnUnauthorized: false }
  );

  const data = await parseJson(response);

  if (!response.ok && response.status !== 401) {
    throw new Error(
      data.message || "No fue posible cerrar la sesión."
    );
  }

  return data;
}

export async function getSystemHealth() {
  const response = await apiFetch("/health");
  const data = await parseJson(response);

  if (!response.ok) {
    throw new Error("No fue posible comprobar el estado de Micapp.");
  }

  return data;
}

export async function getKpiSummary(filters = {}) {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== null && value !== undefined && String(value).trim() !== "") {
      params.set(key, String(value).trim());
    }
  });

  const query = params.toString();
  const response = await apiFetch(
    `/kpis/resumen${query ? `?${query}` : ""}`
  );

  const data = await parseJson(response);

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
  const response = await apiFetch(
    `/kpis/evolucion${query ? `?${query}` : ""}`
  );

  const data = await parseJson(response);

  if (!response.ok) {
    throw new Error(
      data.message || "No fue posible obtener la evolución comercial."
    );
  }

  return data;
}

export async function getKpiFilters() {
  const response = await apiFetch("/kpis/filtros");
  const data = await parseJson(response);

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

  const response = await apiFetch("/importaciones", {
    method: "POST",
    body: formData,
  });

  const data = await parseJson(response);

  if (!response.ok) {
    throw new Error(data.message || "No fue posible importar el archivo.");
  }

  return data;
}

export { API_URL };
