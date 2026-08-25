import { useState, useRef } from "react";
import { useApp } from "../lib/AppContext";
import { DEFAULT_UNITS } from "../lib/uom";
import { ROLES, CURRENCIES } from "../data/seed";
import { exportAllToExcel } from "../lib/exportExcel";
import Panel from "../components/Panel";
import { Field, inputCls, btnCls, btnGhostCls } from "../components/Field";

const blank = { category: "weight", unit: "", baseFactor: "" };

export default function Settings() {
  const { data, setCustomUnits, resetToSeed, clearAllData, updateTheme, setActiveRole, setBranding, setCurrency } = useApp();
  const [form, setForm] = useState(blank);
  const [themeRole, setThemeRole] = useState(data.activeRole);
  const logoInputRef = useRef(null);

  const theme = data.themes?.[themeRole] || {};
  const branding = data.branding || {};
  const currency = data.currency || { code: "NGN", symbol: "₦" };

  const addUnit = (e) => {
    e.preventDefault();
    const cat = form.category;
    const base = cat === "weight" ? "g" : cat === "volume" ? "ml" : "unit";
    const next = { ...data.customUnits };
    if (!next[cat]) next[cat] = { base, factors: {} };
    next[cat].factors[form.unit] = parseFloat(form.baseFactor) || 1;
    setCustomUnits(next);
    setForm(blank);
  };

  const removeUnit = (cat, unit) => {
    const next = { ...data.customUnits };
    if (next[cat]) {
      const { [unit]: _drop, ...rest } = next[cat].factors;
      next[cat] = { ...next[cat], factors: rest };
    }
    setCustomUnits(next);
  };

  const onLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setBranding({ logoDataUrl: reader.result });
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="chip text-ink-400 uppercase">Module 06</div>
        <h1 className="font-display text-xl font-semibold text-ink-50">Settings</h1>
      </div>

      <Panel title="Roles & access" eyebrow="Who's viewing the app right now">
        <div className="grid grid-cols-2 gap-4 mb-3">
          <Field label="Viewing as">
            <select className={inputCls} value={data.activeRole} onChange={(e) => setActiveRole(e.target.value)}>
              {ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </Field>
        </div>
        <p className="text-sm text-ink-400 leading-relaxed">
          This switcher is a stand-in for real login. Once the app is connected to a backend,
          each person will sign in with their own email — a supply officer's email is tagged
          with the supply role, a customer's email is linked to their own customer record — and
          they'll land straight in their portal with no switcher needed. The database and
          permission rules for that are already written in <code className="chip">src/data/schema.sql</code>;
          it just needs a live Supabase project to connect to. Say the word and I'll walk you
          through setting that up.
        </p>
      </Panel>

      <Panel title="Branding" eyebrow="Shown at the top of the sidebar">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <Field label="Company / app name">
            <input className={inputCls} value={branding.name || ""} onChange={(e) => setBranding({ name: e.target.value })} />
          </Field>
          <Field label="Tagline">
            <input className={inputCls} value={branding.tagline || ""} onChange={(e) => setBranding({ tagline: e.target.value })} />
          </Field>
        </div>
        <Field label="Logo">
          <div className="flex items-center gap-3">
            {branding.logoDataUrl && <img src={branding.logoDataUrl} alt="" className="w-10 h-10 rounded object-cover border border-ink-700" />}
            <button type="button" className={btnGhostCls} onClick={() => logoInputRef.current?.click()}>
              {branding.logoDataUrl ? "Change logo" : "Upload logo"}
            </button>
            {branding.logoDataUrl && (
              <button type="button" className="text-ink-500 hover:text-[var(--accent)] text-xs" onClick={() => setBranding({ logoDataUrl: null })}>remove</button>
            )}
            <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={onLogoChange} />
          </div>
        </Field>
      </Panel>

      <Panel title="Appearance" eyebrow="Each role can carry its own brand colors and light/dark mode">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <Field label="Editing theme for">
            <select className={inputCls} value={themeRole} onChange={(e) => setThemeRole(e.target.value)}>
              {ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </Field>
          <Field label="Mode">
            <select className={inputCls} value={theme.mode || "dark"} onChange={(e) => updateTheme(themeRole, { mode: e.target.value })}>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </Field>
          <Field label="Primary accent">
            <div className="flex items-center gap-2">
              <input type="color" className="w-9 h-9 shrink-0 bg-ink-900 border border-ink-700 rounded cursor-pointer" value={theme.accent || "#D97A3E"} onChange={(e) => updateTheme(themeRole, { accent: e.target.value })} />
              <input type="text" className={inputCls} value={theme.accent || "#D97A3E"} onChange={(e) => updateTheme(themeRole, { accent: e.target.value })} placeholder="#D97A3E" />
            </div>
          </Field>
          <Field label="Secondary accent">
            <div className="flex items-center gap-2">
              <input type="color" className="w-9 h-9 shrink-0 bg-ink-900 border border-ink-700 rounded cursor-pointer" value={theme.accentAlt || "#4F8862"} onChange={(e) => updateTheme(themeRole, { accentAlt: e.target.value })} />
              <input type="text" className={inputCls} value={theme.accentAlt || "#4F8862"} onChange={(e) => updateTheme(themeRole, { accentAlt: e.target.value })} placeholder="#4F8862" />
            </div>
          </Field>
        </div>
        <p className="text-xs text-ink-500">
          Switch "Viewing as" above to this role to see it applied — buttons, the active nav
          indicator, and highlighted figures all pick up the primary accent color.
        </p>
      </Panel>

      <Panel title="Currency" eyebrow="Applies to every figure across the app">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <Field label="Preset">
            <select
              className={inputCls}
              value={CURRENCIES.some((c) => c.code === currency.code) ? currency.code : "custom"}
              onChange={(e) => {
                const preset = CURRENCIES.find((c) => c.code === e.target.value);
                if (preset) setCurrency(preset);
              }}
            >
              {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code} · {c.symbol}</option>)}
              <option value="custom">Custom…</option>
            </select>
          </Field>
          <Field label="Symbol shown">
            <input className={inputCls} value={currency.symbol} onChange={(e) => setCurrency({ ...currency, symbol: e.target.value })} placeholder="₦" />
          </Field>
        </div>
      </Panel>

      <Panel title="Units of measure" eyebrow="Built-in conversions, customizable">
        <div className="overflow-x-auto">
<table className="w-full text-sm mb-5" style={{minWidth: "600px"}}>
          <thead>
            <tr className="text-left chip text-ink-500 uppercase border-b border-ink-700">
              <th className="py-2 pr-4">Category</th>
              <th className="py-2 pr-4">Unit</th>
              <th className="py-2 pr-4 text-right">Equals (base units)</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(DEFAULT_UNITS).map(([cat, def]) =>
              Object.entries(def.factors).map(([unit, factor]) => (
                <tr key={cat + unit} className="border-b border-ink-700/60 text-ink-300">
                  <td className="py-1.5 pr-4 chip">{cat}</td>
                  <td className="py-1.5 pr-4">{unit}</td>
                  <td className="py-1.5 pr-4 text-right chip">{factor} {def.base}</td>
                </tr>
              ))
            )}
            {Object.entries(data.customUnits || {}).map(([cat, def]) =>
              Object.entries(def.factors || {}).map(([unit, factor]) => (
                <tr key={"custom" + cat + unit} className="border-b border-ink-700/60 text-brass-400">
                  <td className="py-1.5 pr-4 chip">{cat} · custom</td>
                  <td className="py-1.5 pr-4">{unit}</td>
                  <td className="py-1.5 pr-4 text-right chip">
                    {factor} {DEFAULT_UNITS[cat]?.base || def.base}
                    <button className="ml-3 text-ink-500 hover:text-[var(--accent)] text-xs" onClick={() => removeUnit(cat, unit)}>remove</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
</div>

        <form onSubmit={addUnit} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <Field label="Category">
            <select className={inputCls} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              <option value="weight">weight (base: g)</option>
              <option value="volume">volume (base: ml)</option>
              <option value="count">count (base: unit)</option>
            </select>
          </Field>
          <Field label="New unit name"><input className={inputCls} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="e.g. sack" required /></Field>
          <Field label="Equals how many base units"><input type="number" step="0.0001" className={inputCls} value={form.baseFactor} onChange={(e) => setForm({ ...form, baseFactor: e.target.value })} placeholder="e.g. 50000 (a 50kg sack, in g)" required /></Field>
          <div className="flex items-end"><button type="submit" className={btnCls}>Add unit</button></div>
        </form>
      </Panel>

      <Panel title="Data" eyebrow="Export, reload the demo dataset, or start clean">
        <div className="flex flex-wrap gap-3">
          <button className={btnCls} onClick={() => exportAllToExcel(data)}>Download all data (Excel)</button>
          <button className={btnGhostCls} onClick={() => { if (confirm("Reset all data back to the example dataset? This can't be undone.")) resetToSeed(); }}>Reset to example data</button>
          <button
            className="chip px-3 py-1.5 rounded border border-red-400 text-red-400 hover:bg-red-400/10"
            onClick={() => { if (confirm("Clear ALL data — suppliers, products, production, sales, customers, everything? This can't be undone.")) clearAllData(); }}
          >
            Clear all data
          </button>
        </div>
        <p className="text-xs text-ink-500 mt-3">
          Everything is stored in this browser's local storage — nothing leaves the device this
          is opened on. "Clear all data" wipes it to a blank slate (useful once you're done
          testing and ready to enter your real business data). "Reset to example data" reloads
          the sample granola-business dataset instead.
        </p>
      </Panel>
    </div>
  );
}
