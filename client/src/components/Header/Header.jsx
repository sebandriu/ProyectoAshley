import FilterBar from "../FilterBar/FilterBar";

function Header() {
  return (
    <header className="topbar">
      <div className="topbar-heading">
        <h1>Store Manager</h1>
        <p>Version 1.0 - Prueba</p>
      </div>

      <FilterBar />
    </header>
  );
}

export default Header;
