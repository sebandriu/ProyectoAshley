import { Router } from "express";
import { getSummary } from "../controllers/kpiController.js";

const router = Router();

router.get("/resumen", getSummary);

export default router;
