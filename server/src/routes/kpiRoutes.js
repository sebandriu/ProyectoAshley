import { Router } from "express";
import {
  getFilters,
  getSummary,
} from "../controllers/kpiController.js";

const router = Router();

router.get("/resumen", getSummary);
router.get("/filtros", getFilters);

export default router;
