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
  {
    to: "/",
    label: "Resumen",
    mobileLabel: "Inicio",
    icon: LayoutDashboard,
  },
  {
    to: "/cotizaciones",
    label: "Cotizaciones",
    mobileLabel: "OF",
    icon: FileText,
  },
  {
    to: "/ventas",
    label: "Ventas",
    mobileLabel: "Ventas",
    icon: BadgeDollarSign,
  },
  {
    to: "/productos",
    label: "Productos",
    mobileLabel: "Prod.",
    icon: Package,
  },
  {
    to: "/tiendas",
    label: "Tiendas y vendedores",
    mobileLabel: "Tiendas",
    icon: Users,
  },
  {
    to: "/importacion",
    label: "Importación",
    mobileLabel: "Importar",
    icon: Upload,
  },
];

function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <AppLogo />
      </div>

      <nav className="sidebar-menu" aria-label="Navegación principal">
        {items.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              aria-label={item.label}
              title={item.label}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? "active" : ""}`
              }
            >
              <Icon size={18} />
              <span className="sidebar-link-label">{item.label}</span>
              <span className="sidebar-link-mobile-label">
                {item.mobileLabel}
              </span>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}

export default Sidebar;
