import {
  getAnalyticsFilterOptions,
  getPerformanceAnalytics,
  getProductAnalytics,
  getQuoteAnalytics,
  getSalesAnalytics,
  searchProductCodes,
} from "../services/analyticsService.js";

function filtersFromRequest(req) {
  return {
    desde: req.query.desde,
    hasta: req.query.hasta,
    tienda: req.query.tienda,
    vendedor: req.query.vendedor,
    producto: req.query.producto,
    productos: req.query.productos,
  };
}

function handleError(res, error, fallback) {
  console.error(fallback, error);

  const isValidationError =
    /formato|fecha|posterior/i.test(error.message ?? "");

  return res.status(isValidationError ? 400 : 500).json({
    message: error.message || fallback,
  });
}

export async function getFilters(_req, res) {
  try {
    return res.json(await getAnalyticsFilterOptions());
  } catch (error) {
    return handleError(res, error, "No fue posible obtener los filtros analíticos.");
  }
}

export async function searchProducts(req, res) {
  try {
    const productos = await searchProductCodes(
      req.query.q,
      req.query.limit
    );

    return res.json({ productos });
  } catch (error) {
    return handleError(
      res,
      error,
      "No fue posible buscar códigos de producto."
    );
  }
}

export async function getProducts(req, res) {
  try {
    return res.json(await getProductAnalytics(filtersFromRequest(req)));
  } catch (error) {
    return handleError(res, error, "No fue posible analizar productos y demanda.");
  }
}

export async function getPerformance(req, res) {
  try {
    return res.json(await getPerformanceAnalytics(filtersFromRequest(req)));
  } catch (error) {
    return handleError(res, error, "No fue posible analizar tiendas y vendedores.");
  }
}

export async function getQuotes(req, res) {
  try {
    return res.json(await getQuoteAnalytics(filtersFromRequest(req)));
  } catch (error) {
    return handleError(res, error, "No fue posible consultar las cotizaciones.");
  }
}

export async function getSales(req, res) {
  try {
    return res.json(await getSalesAnalytics(filtersFromRequest(req)));
  } catch (error) {
    return handleError(res, error, "No fue posible consultar las ventas.");
  }
}
