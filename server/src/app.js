import "dotenv/config";

import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import cors from "cors";
import express from "express";

import { closeDatabase } from "./config/database.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";
import healthRoutes from "./routes/healthRoutes.js";
import importRoutes from "./routes/importRoutes.js";
import kpiRoutes from "./routes/kpiRoutes.js";

const app = express();
const PORT = Number(process.env.PORT || 3001);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const clientDistPath = resolve(__dirname, "../../client/dist");
const clientIndexPath = join(clientDistPath, "index.html");
const clientBuildAvailable = existsSync(clientIndexPath);

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  })
);

app.use(express.json());

app.get("/api", (_req, res) => {
  res.json({
    name: "Micapp API",
    version: "0.1.0",
  });
});

app.use("/api/health", healthRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/importaciones", importRoutes);
app.use("/api/kpis", kpiRoutes);

if (clientBuildAvailable) {
  app.use(express.static(clientDistPath));

  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api")) {
      return next();
    }

    return res.sendFile(clientIndexPath);
  });
}

const server = app.listen(PORT, () => {
  console.log(`Micapp API disponible en http://localhost:${PORT}`);

  if (clientBuildAvailable) {
    console.log(
      `Micapp web disponible en http://localhost:${PORT} (build de client/dist)`
    );
  } else {
    console.log(
      "Frontend compilado no encontrado. Para modo demo ejecuta: cd client && npm run build"
    );
  }
});

async function shutdown() {
  server.close(async () => {
    await closeDatabase();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
