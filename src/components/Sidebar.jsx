import { NavLink } from "react-router-dom";
import { useApp } from "../lib/AppContext";
import { canAccess } from "../lib/access";

const allLinks = [
  { to: "/", label: "Overview", code: "00" },
  { to: "/suppliers", label: "Suppliers", code: "01a" },
  { to: "/supply", label: "Supply", code: "01" },
  { to: "/products", label: "Products", code: "02a" },
  { to: "/production", label: "Production", code: "02" },
  { to: "/inventory", label: "Inventory", code: "03" },
  { to: "/sales", label: "Sales", code: "04" },
  { to: "/customers", label: "Customers", code: "05" },
  { to: "/customer-portal", label: "My orders", code: "05a" },
  { to: "/settings", label: "Settings", code: "06" },
];

export default function Sidebar() {
  const { data } = useApp();
  const role = data.activeRole;
  const links = allLinks.filter((l) => canAccess(role, l.to) || l.to === "/settings");
  const branding = data.branding || { name: "Fabrica", tagline: "production line control" };

  return (
    <aside className="w-56 shrink-0 border-r border-ink-700 bg-ink-900 min-h-screen flex flex-col">
      <div className="px-5 pt-6 pb-5 border-b border-ink-700 flex items-center gap-3">
        {branding.logoDataUrl ? (
          <img src={branding.logoDataUrl} alt="" className="w-8 h-8 rounded object-cover" />
        ) : null}
        <div>
          <div className="font-display text-lg font-semibold tracking-tight text-ink-50">{branding.name}</div>
          <div className="chip text-ink-400 mt-0.5">{branding.tagline}</div>
        </div>
      </div>

      <nav className="flex-1 py-3">
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-3 px-5 py-2.5 text-sm border-l-2 transition-colors ${
                isActive
                  ? "border-[var(--accent)] bg-ink-800 text-ink-50"
                  : "border-transparent text-ink-400 hover:text-ink-100 hover:bg-ink-800/60"
              }`
            }
          >
            <span className="chip text-ink-600">{l.code.replace("a", "")}</span>
            <span>{l.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="px-5 py-4 border-t border-ink-700 chip text-ink-600">
        Fabrica ERP · scaffold
      </div>
    </aside>
  );
}
