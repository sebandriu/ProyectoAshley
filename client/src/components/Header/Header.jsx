import { useLocation } from "react-router-dom";

function Header() {
  const location = useLocation();

  const titles = {
    "/": "Resumen comercial",
    "/cotizaciones": "Cotizaciones",
    "/ventas": "Ventas",
    "/productos": "Productos y demanda",
    "/tiendas": "Tiendas y vendedores",
    "/importacion": "Importar datos"
  };

  return (
    <header className="topbar">
      <div>
        <h1>{titles[location.pathname] || "Ashley Analytics"}</h1>
        <p>Mockup version 1.0</p>
      </div>

      {location.pathname !== "/importacion" && (
        <div className="topbar-filters">
          <select>
            <option>Período</option>
          </select>

          <select>
            <option>Tienda</option>
          </select>

          <select>
            <option>Vendedor</option>
          </select>

          <select>
            <option>Producto</option>
          </select>
        </div>
      )}
    </header>
  );
}

export default Header;