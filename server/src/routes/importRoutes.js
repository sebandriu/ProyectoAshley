import { Router } from "express";
import multer from "multer";

import { importExcel } from "../controllers/importController.js";

const router = Router();

const MAX_FILE_SIZE_MB = 50;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_MB * 1024 * 1024,
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

router.post("/", (req, res, next) => {
  upload.single("archivo")(req, res, (error) => {
    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({
          message: `El archivo supera el límite de ${MAX_FILE_SIZE_MB} MB permitido por Micapp.`,
        });
      }

      return res.status(400).json({
        message: error.message || "No fue posible recibir el archivo.",
      });
    }

    if (error) {
      return res.status(400).json({
        message: error.message || "No fue posible recibir el archivo.",
      });
    }

    return importExcel(req, res, next);
  });
});

export default router;
