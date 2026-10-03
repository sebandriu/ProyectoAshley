import { useState } from "react";
import {
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import AppLogo from "../../components/AppLogo/AppLogo";
import { loginSession } from "../../services/api";

function Login({ onAuthenticated }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();

    if (!username.trim() || !password) {
      setError("Ingresa tu usuario y contraseña.");
      return;
    }

    setStatus("loading");
    setError("");

    try {
      const response = await loginSession({
        username,
        password,
      });

      onAuthenticated?.(response.user);
    } catch (requestError) {
      setError(requestError.message);
      setStatus("error");
    }
  }

  return (
    <main className="login-page">
      <section className="login-shell">
        <div className="login-brand-panel">
          <AppLogo />

          <div className="login-brand-copy">
            <span className="login-brand-badge">
              <ShieldCheck size={15} />
              Acceso protegido
            </span>

            <h1>Información comercial en un solo lugar.</h1>
            <p>
              Micapp consolida indicadores y análisis provenientes de la
              información autorizada de SAP Business One.
            </p>
          </div>

          <small>Acceso exclusivo para usuarios autorizados.</small>
        </div>

        <div className="login-form-panel">
          <div className="login-form-wrap">
            <div className="login-heading">
              <span className="login-lock">
                <LockKeyhole size={20} />
              </span>
              <div>
                <span>Micapp</span>
                <h2>Iniciar sesión</h2>
              </div>
            </div>

            <p className="login-intro">
              Ingresa tus credenciales para acceder al panel de Store Manager.
            </p>

            <form className="login-form" onSubmit={handleSubmit}>
              <label>
                Usuario
                <div className="login-input">
                  <UserRound size={17} aria-hidden="true" />
                  <input
                    type="text"
                    value={username}
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck="false"
                    placeholder="Usuario"
                    disabled={status === "loading"}
                    onChange={(event) => setUsername(event.target.value)}
                  />
                </div>
              </label>

              <label>
                Contraseña
                <div className="login-input">
                  <LockKeyhole size={17} aria-hidden="true" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    autoComplete="current-password"
                    placeholder="Contraseña"
                    disabled={status === "loading"}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  <button
                    type="button"
                    className="login-password-toggle"
                    aria-label={
                      showPassword
                        ? "Ocultar contraseña"
                        : "Mostrar contraseña"
                    }
                    title={
                      showPassword
                        ? "Ocultar contraseña"
                        : "Mostrar contraseña"
                    }
                    onClick={() => setShowPassword((current) => !current)}
                  >
                    {showPassword ? (
                      <EyeOff size={17} />
                    ) : (
                      <Eye size={17} />
                    )}
                  </button>
                </div>
              </label>

              {error && (
                <div className="login-error" role="alert">
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="login-submit"
                disabled={status === "loading"}
              >
                {status === "loading"
                  ? "Verificando..."
                  : "Ingresar a Micapp"}
              </button>
            </form>

            <p className="login-security-note">
              La sesión se mantiene mediante una cookie HttpOnly. La contraseña
              no se almacena en el navegador.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

export default Login;
