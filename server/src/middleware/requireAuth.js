import {
  getSessionTokenFromRequest,
  getUserFromSessionToken,
  SESSION_COOKIE,
} from "../services/authService.js";

export async function requireAuth(req, res, next) {
  try {
    const token = getSessionTokenFromRequest(req);
    const user = await getUserFromSessionToken(token);

    if (!user) {
      if (token) {
        res.clearCookie(SESSION_COOKIE, {
          httpOnly: true,
          sameSite: "lax",
          path: "/",
        });
      }

      return res.status(401).json({
        message: "Debes iniciar sesión para acceder a Micapp.",
      });
    }

    req.user = user;
    req.sessionToken = token;

    return next();
  } catch (error) {
    console.error("Error al validar sesión:", error);

    return res.status(500).json({
      message: "No fue posible validar la sesión.",
    });
  }
}
