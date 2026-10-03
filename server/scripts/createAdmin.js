import "dotenv/config";

import { closeDatabase } from "../src/config/database.js";
import {
  initializeAuth,
  upsertUser,
} from "../src/services/authService.js";

async function main() {
  const username = process.env.MICAPP_ADMIN_USER;
  const password = process.env.MICAPP_ADMIN_PASSWORD;
  const displayName =
    process.env.MICAPP_ADMIN_NAME || "Store Manager";

  if (!username || !password) {
    throw new Error(
      "Define MICAPP_ADMIN_USER y MICAPP_ADMIN_PASSWORD antes de ejecutar este comando."
    );
  }

  await initializeAuth();

  const user = await upsertUser({
    username,
    password,
    displayName,
    role: "STORE_MANAGER",
  });

  console.log(
    `Usuario ${user.username} creado/actualizado correctamente.`
  );
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase();
  });
