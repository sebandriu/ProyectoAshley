import {
  getKpiEvolution,
  getKpiFilterOptions,
  getKpiSummary,
} from "../services/kpiService.js";

export async function getSummary(req, res) {
  try {
    const summary = await getKpiSummary({
      desde: req.query.desde,
      hasta: req.query.hasta,
      tienda: req.query.tienda,
      vendedor: req.query.vendedor,
    });

    return res.json(summary);
  } catch (error) {
    console.error("Error al calcular KPIs:", error);

    const isValidationError =
      /formato|fecha|posterior/i.test(error.message ?? "");

    return res.status(isValidationError ? 400 : 500).json({
      message:
        error.message ||
        "No fue posible calcular el resumen de indicadores.",
    });
  }
}


export async function getFilters(_req, res) {
  try {
    const filters = await getKpiFilterOptions();
    return res.json(filters);
  } catch (error) {
    console.error("Error al obtener filtros KPI:", error);

    return res.status(500).json({
      message:
        error.message ||
        "No fue posible obtener los filtros disponibles.",
    });
  }
}


export async function getEvolution(req, res) {
  try {
    const evolution = await getKpiEvolution({
      desde: req.query.desde,
      hasta: req.query.hasta,
      tienda: req.query.tienda,
      vendedor: req.query.vendedor,
    });

    return res.json(evolution);
  } catch (error) {
    console.error("Error al calcular evolución KPI:", error);

    const isValidationError =
      /formato|fecha|posterior/i.test(error.message ?? "");

    return res.status(isValidationError ? 400 : 500).json({
      message:
        error.message ||
        "No fue posible calcular la evolución comercial.",
    });
  }
}
