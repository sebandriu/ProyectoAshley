import { useEffect, useState } from "react";
import {
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import MainLayout from "./layouts/MainLayout";

import Cotizaciones from "./views/Cotizaciones/Cotizaciones";
import Dashboard from "./views/Dashboard/Dashboard";
import Importacion from "./views/Importacion/Importacion";
import Login from "./views/Login/Login";
import Productos from "./views/Productos/Productos";
import TiendasVendedores from "./views/TiendasVendedores/TiendasVendedores";
import Ventas from "./views/Ventas/Ventas";

import { getCurrentSession } from "./services/api";

import "./App.css";

function App() {
  const [authStatus, setAuthStatus] = useState("checking");
  const [user, setUser] = useState(null);

  useEffect(() => {
    let active = true;

    getCurrentSession()
      .then((session) => {
        if (!active) return;

        if (session.authenticated && session.user) {
          setUser(session.user);
          setAuthStatus("authenticated");
          return;
        }

        setUser(null);
        setAuthStatus("anonymous");
      })
      .catch(() => {
        if (!active) return;
        setUser(null);
        setAuthStatus("anonymous");
      });

    function handleUnauthorized() {
      setUser(null);
      setAuthStatus("anonymous");
    }

    window.addEventListener(
      "micapp:unauthorized",
      handleUnauthorized
    );

    return () => {
      active = false;
      window.removeEventListener(
        "micapp:unauthorized",
        handleUnauthorized
      );
    };
  }, []);

  if (authStatus === "checking") {
    return (
      <main className="auth-loading-screen">
        <div className="auth-loading-card">
          <span className="auth-loading-mark">M</span>
          <strong>Micapp</strong>
          <span>Verificando acceso seguro...</span>
        </div>
      </main>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          authStatus === "authenticated" ? (
            <Navigate to="/" replace />
          ) : (
            <Login
              onAuthenticated={(authenticatedUser) => {
                setUser(authenticatedUser);
                setAuthStatus("authenticated");
              }}
            />
          )
        }
      />

      <Route
        element={
          authStatus === "authenticated" && user ? (
            <MainLayout />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/cotizaciones" element={<Cotizaciones />} />
        <Route path="/ventas" element={<Ventas />} />
        <Route path="/productos" element={<Productos />} />
        <Route path="/tiendas" element={<TiendasVendedores />} />
        <Route path="/importacion" element={<Importacion />} />
      </Route>

      <Route
        path="*"
        element={
          <Navigate
            to={
              authStatus === "authenticated"
                ? "/"
                : "/login"
            }
            replace
          />
        }
      />
    </Routes>
  );
}

export default App;
