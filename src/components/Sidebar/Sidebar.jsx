import { NavLink } from "react-router-dom";

import {
  LayoutDashboard,
  FileText,
  DollarSign,
  Sofa,
  Users,
  Upload
} from "lucide-react";

function Sidebar() {
  const menu = [
    {
      path: "/",
      icon: LayoutDashboard,
      label: "Resumen"
    },
    {
      path: "/cotizaciones",
      icon: FileText,
      label: "Cotizaciones"
    },
    {
      path: "/ventas",
      icon: DollarSign,
      label: "Ventas"
    },
    {
      path: "/productos",
      icon: Sofa,
      label: "Productos"
    },
    {
      path: "/tiendas",
      icon: Users,
      label: "Tiendas y vendedores"
    }
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        A
      </div>

      <nav className="sidebar-menu">
        {menu.map(({ path, icon: Icon, label }) => (
          <NavLink
            key={path}
            to={path}
            end={path === "/"}
            className={({ isActive }) =>
              `sidebar-link ${isActive ? "active" : ""}`
            }
            title={label}
          >
            <Icon size={19} strokeWidth={1.8} />
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <NavLink
          to="/importacion"
          className={({ isActive }) =>
            `sidebar-link ${isActive ? "active" : ""}`
          }
          title="Importar datos"
        >
          <Upload size={19} strokeWidth={1.8} />
        </NavLink>
      </div>
    </aside>
  );
}

export default Sidebar;