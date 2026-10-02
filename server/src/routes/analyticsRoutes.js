import { Router } from "express";
import {
  getFilters,
  getPerformance,
  getProducts,
  getQuotes,
  getSales,
  searchProducts,
  searchSellers,
} from "../controllers/analyticsController.js";

const router = Router();

router.get("/filtros", getFilters);
router.get("/productos/buscar", searchProducts);
router.get("/vendedores/buscar", searchSellers);
router.get("/productos", getProducts);
router.get("/rendimiento", getPerformance);
router.get("/cotizaciones", getQuotes);
router.get("/ventas", getSales);

export default router;
