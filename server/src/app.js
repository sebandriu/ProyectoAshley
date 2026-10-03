import "dotenv/config";

import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import cors from "cors";
import express from "express";

import { closeDatabase } from "./config/database.js";
import { requireAuth } from "./middleware/requireAuth.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import healthRoutes from "./routes/healthRoutes.js";
import importRoutes from "./routes/importRoutes.js";
import kpiRoutes from "./routes/kpiRoutes.js";
import { initializeAuth } from "./services/authService.js";

const app = express();
const PORT = Number(process.env.PORT || 3001);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const clientDistPath = resolve(__dirname, "../../client/dist");
const clientIndexPath = join(clientDistPath, "index.html");
const clientBuildAvailable = existsSync(clientIndexPath);

const allowedOrigins = new Set(
  String(process.env.CLIENT_ORIGIN || "http://localhost:5173")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
);

app.disable("x-powered-by");

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");

  next();
});

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origen no permitido por Micapp."));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "1mb" }));

app.get("/api", (_req, res) => {
  res.json({
    name: "Micapp API",
    version: "0.2.0",
  });
});

app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);

app.use("/api/analytics", requireAuth, analyticsRoutes);
app.use("/api/importaciones", requireAuth, importRoutes);
app.use("/api/kpis", requireAuth, kpiRoutes);

if (clientBuildAvailable) {
  app.use(express.static(clientDistPath));

  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api")) {
      return next();
    }

    return res.sendFile(clientIndexPath);
  });
}

let server;

async function start() {
  try {
    await initializeAuth();

    server = app.listen(PORT, () => {
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

      console.log("Autenticación Micapp activa.");
    });
  } catch (error) {
    console.error("No fue posible iniciar Micapp:", error);
    await closeDatabase().catch(() => {});
    process.exit(1);
  }
}

async function shutdown() {
  if (!server) {
    await closeDatabase();
    process.exit(0);
    return;
  }

  server.close(async () => {
    await closeDatabase();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

start();
