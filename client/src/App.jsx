import { Routes, Route } from "react-router-dom";

import MainLayout from "./layouts/MainLayout";

import Dashboard from "./views/Dashboard/Dashboard";
import Cotizaciones from "./views/Cotizaciones/Cotizaciones";
import Ventas from "./views/Ventas/Ventas";
import Productos from "./views/Productos/Productos";
import TiendasVendedores from "./views/TiendasVendedores/TiendasVendedores";
import Importacion from "./views/Importacion/Importacion";

import "./App.css";

function App() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/cotizaciones" element={<Cotizaciones />} />
        <Route path="/ventas" element={<Ventas />} />
        <Route path="/productos" element={<Productos />} />
        <Route path="/tiendas" element={<TiendasVendedores />} />
        <Route path="/importacion" element={<Importacion />} />
      </Route>
    </Routes>
  );
}

export default App;