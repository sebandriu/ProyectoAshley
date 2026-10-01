import { useLocation } from "react-router-dom";

import FilterBar from "../FilterBar/FilterBar";

function Header() {
  const location = useLocation();
  const isDashboard = location.pathname === "/";

  return (
    <header className="topbar">
      <div className="topbar-heading">
        <h1>Store Manager</h1>
        <p>Version 1.0 - Prueba</p>
      </div>

      <FilterBar
        visibleFilters={
          isDashboard
            ? ["periodo", "tienda"]
            : ["periodo", "tienda", "vendedor", "producto"]
        }
      />
    </header>
  );
}

export default Header;
