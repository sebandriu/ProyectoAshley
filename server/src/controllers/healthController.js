import { pool } from "../config/database.js";

export async function getHealth(_req, res) {
  try {
    const result = await pool.query(
      "SELECT NOW() AS db_time, current_database() AS database"
    );

    return res.json({
      status: "ok",
      backend: "online",
      database: "online",
      databaseName: result.rows[0].database,
      databaseTime: result.rows[0].db_time,
    });
  } catch (error) {
    console.error("Database health check failed:", error.message);

    return res.status(503).json({
      status: "error",
      backend: "online",
      database: "offline",
      message: "Micapp no pudo conectarse a PostgreSQL.",
    });
  }
}
