function Header() {
  return (
    <header className="topbar">
      <div>
        <h1>Store Manager</h1>
        <p>Version 1.0 - Prueba</p>
      </div>

      <div className="topbar-filters">
        <select>
          <option>Período</option>
          <option>Últimos 30 días</option>
          <option>Últimos 90 días</option>
          <option>Año actual</option>
        </select>

        <select>
          <option>Tienda</option>
          <option>Antofagasta</option>
          <option>Todas</option>
        </select>

        <select>
          <option>Vendedor</option>
          <option>Todos</option>
        </select>

        <select>
          <option>Producto</option>
          <option>Todos</option>
        </select>
      </div>
    </header>
  );
}

export default Header;