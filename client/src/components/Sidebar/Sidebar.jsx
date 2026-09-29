import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  FileText,
  BadgeDollarSign,
  Package,
  Users,
  Upload,
} from "lucide-react";
import AppLogo from "../AppLogo/AppLogo";

const items = [
  { to: "/", label: "Resumen", icon: LayoutDashboard },
  { to: "/cotizaciones", label: "Cotizaciones", icon: FileText },
  { to: "/ventas", label: "Ventas", icon: BadgeDollarSign },
  { to: "/productos", label: "Productos", icon: Package },
  { to: "/tiendas", label: "Tiendas y vendedores", icon: Users },
  { to: "/importacion", label: "Importación", icon: Upload },
];

function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <AppLogo />
      </div>

      <nav className="sidebar-menu">
        {items.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? "active" : ""}`
              }
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}

export default Sidebar;