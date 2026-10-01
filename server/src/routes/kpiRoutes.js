import { Router } from "express";
import {
  getEvolution,
  getFilters,
  getSummary,
} from "../controllers/kpiController.js";

const router = Router();

router.get("/resumen", getSummary);
router.get("/filtros", getFilters);
router.get("/evolucion", getEvolution);

export default router;
