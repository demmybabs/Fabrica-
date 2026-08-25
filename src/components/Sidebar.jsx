import { NavLink } from "react-router-dom";
import { useState } from "react";
import { useApp } from "../lib/AppContext";
import { canAccess } from "../lib/access";

const allLinks = [
  { to: "/", label: "Overview", code: "00" },
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const role = data.activeRole;
  const links = allLinks.filter((l) => canAccess(role, l.to) || l.to === "/settings");
  const branding = data.branding || { name: "Fabrica", tagline: "production line control" };

  const content = (
    <>
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
            onClick={() => setMobileOpen(false)}
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
    </>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-ink-900 border-b border-ink-700">
        <div className="flex items-center gap-2">
          {branding.logoDataUrl && <img src={branding.logoDataUrl} alt="" className="w-6 h-6 rounded object-cover" />}
          <span className="font-display text-base font-semibold text-ink-50">{branding.name}</span>
        </div>
        <button
          aria-label="Open menu"
          className="text-ink-200 border border-ink-700 rounded px-2.5 py-1.5"
          onClick={() => setMobileOpen(true)}
        >
          ☰
        </button>
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 shrink-0 border-r border-ink-700 bg-ink-900 min-h-screen flex-col">
        {content}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="w-64 bg-ink-900 border-r border-ink-700 min-h-screen flex flex-col">
            <div className="flex justify-end px-4 pt-3">
              <button aria-label="Close menu" className="text-ink-400 text-xl leading-none" onClick={() => setMobileOpen(false)}>×</button>
            </div>
            {content}
          </div>
          <div className="flex-1 bg-black/50" onClick={() => setMobileOpen(false)} />
        </div>
      )}
    </>
  );
}

