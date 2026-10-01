import { Router } from "express";
import multer from "multer";

import { importExcel } from "../controllers/importController.js";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024,
  },
  fileFilter: (_req, file, callback) => {
    const isXlsx =
      file.originalname.toLowerCase().endsWith(".xlsx") ||
      file.mimetype ===
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    if (!isXlsx) {
      return callback(new Error("Micapp solo acepta archivos .xlsx."));
    }

    callback(null, true);
  },
});

router.post("/", upload.single("archivo"), importExcel);

export default router;
