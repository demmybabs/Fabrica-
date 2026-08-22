import { NavLink } from "react-router-dom";

const links = [
  { to: "/", label: "Overview", code: "00" },
  { to: "/supply", label: "Supply", code: "01" },
  { to: "/production", label: "Production", code: "02" },
  { to: "/inventory", label: "Inventory", code: "03" },
  { to: "/sales", label: "Sales", code: "04" },
  { to: "/customers", label: "Customers", code: "05" },
  { to: "/settings", label: "Settings", code: "06" },
];

export default function Sidebar() {
  return (
    <aside className="w-56 shrink-0 border-r border-ink-700 bg-ink-900 min-h-screen flex flex-col">
      <div className="px-5 pt-6 pb-5 border-b border-ink-700">
        <div className="font-display text-lg font-semibold tracking-tight text-ink-50">Fabrica</div>
        <div className="chip text-ink-400 mt-1">production line control</div>
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
                  ? "border-rust-500 bg-ink-800 text-ink-50"
                  : "border-transparent text-ink-400 hover:text-ink-100 hover:bg-ink-800/60"
              }`
            }
          >
            <span className="chip text-ink-600">{l.code}</span>
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
