import { Router } from "express";

import {
  login,
  logout,
  session,
} from "../controllers/authController.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

router.post("/login", login);
router.get("/session", requireAuth, session);
router.post("/logout", requireAuth, logout);

export default router;
