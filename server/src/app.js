import "dotenv/config";

import cors from "cors";
import express from "express";

import { closeDatabase } from "./config/database.js";
import healthRoutes from "./routes/healthRoutes.js";
import importRoutes from "./routes/importRoutes.js";
import kpiRoutes from "./routes/kpiRoutes.js";

const app = express();
const PORT = Number(process.env.PORT || 3001);

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
app.use("/api/importaciones", importRoutes);
app.use("/api/kpis", kpiRoutes);

const server = app.listen(PORT, () => {
  console.log(`Micapp API disponible en http://localhost:${PORT}`);
});

async function shutdown() {
  server.close(async () => {
    await closeDatabase();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
