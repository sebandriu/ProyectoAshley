import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

import { pool } from "../config/database.js";

const scrypt = promisify(scryptCallback);

export const SESSION_COOKIE = "micapp_session";
export const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

const BOOTSTRAP_USER = {
  username: "ashsmant",
  displayName: "Store Manager",
  role: "STORE_MANAGER",
  passwordHash:
    "scrypt$16384$8$1$VZujFyDf+9Jq//d+PxD33w==$Z6QvnOvVvNlZjJwROpauk8AUajQQg9BNcdL5UIWbiQZ/uQOqvsZWDWfilUi0+4nszUsC9WRugjYHbviu/KXoqg==",
};

function normalizeUsername(value) {
  return String(value ?? "").trim().toLowerCase();
}

function tokenHash(token) {
  return createHash("sha256").update(token).digest("hex");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function hashPassword(password) {
  const text = String(password ?? "");

  if (text.length < 6) {
    throw new Error("La contraseña debe tener al menos 6 caracteres.");
  }

  const salt = randomBytes(16);
  const n = 16384;
  const r = 8;
  const p = 1;
  const derivedKey = await scrypt(text, salt, 64, {
    N: n,
    r,
    p,
    maxmem: 64 * 1024 * 1024,
  });

  return [
    "scrypt",
    n,
    r,
    p,
    salt.toString("base64"),
    Buffer.from(derivedKey).toString("base64"),
  ].join("$");
}

export async function verifyPassword(password, encodedHash) {
  try {
    const [algorithm, nText, rText, pText, saltText, hashText] =
      String(encodedHash ?? "").split("$");

    if (
      algorithm !== "scrypt" ||
      !nText ||
      !rText ||
      !pText ||
      !saltText ||
      !hashText
    ) {
      return false;
    }

    const expected = Buffer.from(hashText, "base64");
    const actual = await scrypt(
      String(password ?? ""),
      Buffer.from(saltText, "base64"),
      expected.length,
      {
        N: Number(nText),
        r: Number(rText),
        p: Number(pText),
        maxmem: 64 * 1024 * 1024,
      }
    );

    const actualBuffer = Buffer.from(actual);

    return (
      actualBuffer.length === expected.length &&
      timingSafeEqual(actualBuffer, expected)
    );
  } catch {
    return false;
  }
}

export async function initializeAuth() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id BIGSERIAL PRIMARY KEY,
      usuario VARCHAR(80) NOT NULL UNIQUE,
      nombre VARCHAR(120) NOT NULL,
      rol VARCHAR(30) NOT NULL DEFAULT 'STORE_MANAGER'
        CHECK (rol IN ('STORE_MANAGER', 'ADMIN')),
      password_hash TEXT NOT NULL,
      activo BOOLEAN NOT NULL DEFAULT TRUE,
      intentos_fallidos INTEGER NOT NULL DEFAULT 0,
      bloqueado_hasta TIMESTAMPTZ,
      ultimo_acceso TIMESTAMPTZ,
      creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS sesiones_usuario (
      id BIGSERIAL PRIMARY KEY,
      usuario_id BIGINT NOT NULL
        REFERENCES usuarios(id) ON DELETE CASCADE,
      token_hash CHAR(64) NOT NULL UNIQUE,
      creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expira_en TIMESTAMPTZ NOT NULL,
      ultima_actividad TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_sesiones_usuario_expira
      ON sesiones_usuario(expira_en);

    CREATE INDEX IF NOT EXISTS idx_sesiones_usuario_usuario
      ON sesiones_usuario(usuario_id);
  `);

  await pool.query(
    `
      INSERT INTO usuarios (
        usuario,
        nombre,
        rol,
        password_hash
      )
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (usuario) DO NOTHING
    `,
    [
      BOOTSTRAP_USER.username,
      BOOTSTRAP_USER.displayName,
      BOOTSTRAP_USER.role,
      BOOTSTRAP_USER.passwordHash,
    ]
  );

  await pool.query(
    "DELETE FROM sesiones_usuario WHERE expira_en <= NOW()"
  );
}

export async function authenticateUser(username, password) {
  const normalized = normalizeUsername(username);

  if (!normalized || !password) {
    await delay(180);
    return { ok: false, locked: false };
  }

  const result = await pool.query(
    `
      SELECT
        id,
        usuario,
        nombre,
        rol,
        password_hash,
        activo,
        intentos_fallidos,
        bloqueado_hasta
      FROM usuarios
      WHERE LOWER(usuario) = LOWER($1)
      LIMIT 1
    `,
    [normalized]
  );

  const user = result.rows[0];

  if (!user || !user.activo) {
    await delay(220);
    return { ok: false, locked: false };
  }

  if (
    user.bloqueado_hasta &&
    new Date(user.bloqueado_hasta).getTime() > Date.now()
  ) {
    await delay(220);
    return {
      ok: false,
      locked: true,
      blockedUntil: user.bloqueado_hasta,
    };
  }

  const valid = await verifyPassword(password, user.password_hash);

  if (!valid) {
    const failedAttempts = Number(user.intentos_fallidos || 0) + 1;
    const shouldLock = failedAttempts >= MAX_FAILED_ATTEMPTS;

    const update = await pool.query(
      `
        UPDATE usuarios
        SET
          intentos_fallidos = $2,
          bloqueado_hasta = CASE
            WHEN $3::boolean
              THEN NOW() + ($4::text || ' minutes')::interval
            ELSE NULL
          END,
          actualizado_en = NOW()
        WHERE id = $1
        RETURNING bloqueado_hasta
      `,
      [
        user.id,
        shouldLock ? 0 : failedAttempts,
        shouldLock,
        LOCK_MINUTES,
      ]
    );

    await delay(220);

    return {
      ok: false,
      locked: shouldLock,
      blockedUntil: update.rows[0]?.bloqueado_hasta ?? null,
    };
  }

  const token = randomBytes(32).toString("base64url");
  const hashedToken = tokenHash(token);

  await pool.query("BEGIN");

  try {
    await pool.query(
      "DELETE FROM sesiones_usuario WHERE usuario_id = $1 OR expira_en <= NOW()",
      [user.id]
    );

    await pool.query(
      `
        INSERT INTO sesiones_usuario (
          usuario_id,
          token_hash,
          expira_en
        )
        VALUES (
          $1,
          $2,
          NOW() + ($3::text || ' milliseconds')::interval
        )
      `,
      [user.id, hashedToken, SESSION_MAX_AGE_MS]
    );

    await pool.query(
      `
        UPDATE usuarios
        SET
          intentos_fallidos = 0,
          bloqueado_hasta = NULL,
          ultimo_acceso = NOW(),
          actualizado_en = NOW()
        WHERE id = $1
      `,
      [user.id]
    );

    await pool.query("COMMIT");
  } catch (error) {
    await pool.query("ROLLBACK");
    throw error;
  }

  return {
    ok: true,
    token,
    user: {
      id: Number(user.id),
      username: user.usuario,
      name: user.nombre,
      role: user.rol,
    },
  };
}

export function getSessionTokenFromRequest(req) {
  const cookieHeader = String(req.headers.cookie ?? "");

  const cookies = cookieHeader
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);

  for (const cookie of cookies) {
    const separator = cookie.indexOf("=");

    if (separator <= 0) continue;

    const name = cookie.slice(0, separator);
    const value = cookie.slice(separator + 1);

    if (name === SESSION_COOKIE) {
      return decodeURIComponent(value);
    }
  }

  return null;
}

export async function getUserFromSessionToken(token) {
  if (!token) return null;

  const result = await pool.query(
    `
      SELECT
        u.id,
        u.usuario,
        u.nombre,
        u.rol
      FROM sesiones_usuario s
      INNER JOIN usuarios u ON u.id = s.usuario_id
      WHERE s.token_hash = $1
        AND s.expira_en > NOW()
        AND u.activo = TRUE
      LIMIT 1
    `,
    [tokenHash(token)]
  );

  const user = result.rows[0];

  if (!user) return null;

  return {
    id: Number(user.id),
    username: user.usuario,
    name: user.nombre,
    role: user.rol,
  };
}

export async function destroySession(token) {
  if (!token) return;

  await pool.query(
    "DELETE FROM sesiones_usuario WHERE token_hash = $1",
    [tokenHash(token)]
  );
}

export async function upsertUser({
  username,
  password,
  displayName = "Store Manager",
  role = "STORE_MANAGER",
}) {
  const normalized = normalizeUsername(username);

  if (!normalized) {
    throw new Error("Debes indicar un nombre de usuario.");
  }

  const passwordHash = await hashPassword(password);

  const result = await pool.query(
    `
      INSERT INTO usuarios (
        usuario,
        nombre,
        rol,
        password_hash,
        activo
      )
      VALUES ($1, $2, $3, $4, TRUE)
      ON CONFLICT (usuario)
      DO UPDATE SET
        nombre = EXCLUDED.nombre,
        rol = EXCLUDED.rol,
        password_hash = EXCLUDED.password_hash,
        activo = TRUE,
        intentos_fallidos = 0,
        bloqueado_hasta = NULL,
        actualizado_en = NOW()
      RETURNING id, usuario, nombre, rol
    `,
    [normalized, displayName, role, passwordHash]
  );

  await pool.query(
    `
      DELETE FROM sesiones_usuario
      WHERE usuario_id = $1
    `,
    [result.rows[0].id]
  );

  return {
    id: Number(result.rows[0].id),
    username: result.rows[0].usuario,
    name: result.rows[0].nombre,
    role: result.rows[0].rol,
  };
}
