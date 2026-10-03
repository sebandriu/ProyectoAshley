import {
  authenticateUser,
  destroySession,
  getSessionTokenFromRequest,
  SESSION_COOKIE,
  SESSION_MAX_AGE_MS,
} from "../services/authService.js";

function secureCookieEnabled() {
  return (
    process.env.NODE_ENV === "production" ||
    String(process.env.COOKIE_SECURE ?? "").toLowerCase() === "true"
  );
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookieEnabled(),
    path: "/",
    maxAge: SESSION_MAX_AGE_MS,
  };
}

export async function login(req, res) {
  try {
    const username = String(req.body?.username ?? "").trim();
    const password = String(req.body?.password ?? "");

    if (!username || !password) {
      return res.status(400).json({
        message: "Ingresa usuario y contraseña.",
      });
    }

    const result = await authenticateUser(username, password);

    if (!result.ok) {
      if (result.locked) {
        return res.status(429).json({
          message:
            "Acceso temporalmente bloqueado por varios intentos fallidos. Intenta nuevamente en 15 minutos.",
        });
      }

      return res.status(401).json({
        message: "Usuario o contraseña incorrectos.",
      });
    }

    res.cookie(SESSION_COOKIE, result.token, cookieOptions());

    return res.json({
      authenticated: true,
      user: result.user,
    });
  } catch (error) {
    console.error("Error al iniciar sesión:", error);

    return res.status(500).json({
      message: "No fue posible iniciar sesión.",
    });
  }
}

export function session(req, res) {
  return res.json({
    authenticated: true,
    user: req.user,
  });
}

export async function logout(req, res) {
  try {
    const token =
      req.sessionToken || getSessionTokenFromRequest(req);

    await destroySession(token);

    res.clearCookie(SESSION_COOKIE, {
      httpOnly: true,
      sameSite: "lax",
      secure: secureCookieEnabled(),
      path: "/",
    });

    return res.json({
      authenticated: false,
    });
  } catch (error) {
    console.error("Error al cerrar sesión:", error);

    return res.status(500).json({
      message: "No fue posible cerrar la sesión.",
    });
  }
}
