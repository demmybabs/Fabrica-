import { NavLink } from "react-router-dom";
import { useApp } from "../lib/AppContext";
import { ROLES } from "../data/seed";
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
  const { data, setActiveRole } = useApp();
  const role = data.activeRole;
  const links = allLinks.filter((l) => canAccess(role, l.to) || l.to === "/settings");

  return (
    <aside className="w-56 shrink-0 border-r border-ink-700 bg-ink-900 min-h-screen flex flex-col">
      <div className="px-5 pt-6 pb-5 border-b border-ink-700">
        <div className="font-display text-lg font-semibold tracking-tight text-ink-50">Fabrica</div>
        <div className="chip text-ink-400 mt-1">production line control</div>
      </div>

      <div className="px-5 py-3 border-b border-ink-700">
        <div className="chip text-ink-500 uppercase mb-1">Viewing as</div>
        <select
          className="w-full bg-ink-800 border border-ink-700 rounded px-2 py-1.5 text-xs text-ink-200 focus:outline-none focus:border-[var(--accent)]"
          value={role}
          onChange={(e) => setActiveRole(e.target.value)}
        >
          {ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
        </select>
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
