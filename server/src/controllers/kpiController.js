import { getKpiSummary } from "../services/kpiService.js";

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
