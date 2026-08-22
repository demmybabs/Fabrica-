import { useState } from "react";
import { useApp } from "../lib/AppContext";
import { DEFAULT_UNITS } from "../lib/uom";
import { ROLES } from "../data/seed";
import Panel from "../components/Panel";
import { Field, inputCls, btnCls, btnGhostCls } from "../components/Field";

const blank = { category: "weight", unit: "", baseFactor: "" };

export default function Settings() {
  const { data, setCustomUnits, resetToSeed, updateTheme } = useApp();
  const [form, setForm] = useState(blank);
  const [themeRole, setThemeRole] = useState(data.activeRole);

  const theme = data.themes?.[themeRole] || {};

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

  return (
    <div className="space-y-6">
      <div>
        <div className="chip text-ink-400 uppercase">Module 06</div>
        <h1 className="font-display text-xl font-semibold text-ink-50">Settings</h1>
      </div>

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
            <input type="color" className="w-full h-9 bg-ink-900 border border-ink-700 rounded cursor-pointer" value={theme.accent || "#D97A3E"} onChange={(e) => updateTheme(themeRole, { accent: e.target.value })} />
          </Field>
          <Field label="Secondary accent">
            <input type="color" className="w-full h-9 bg-ink-900 border border-ink-700 rounded cursor-pointer" value={theme.accentAlt || "#4F8862"} onChange={(e) => updateTheme(themeRole, { accentAlt: e.target.value })} />
          </Field>
        </div>
        <p className="text-xs text-ink-500">
          Switch to this role in the sidebar to see the change applied — buttons, the active nav
          indicator, and highlighted figures all pick up the primary accent color.
        </p>
      </Panel>

      <Panel title="Units of measure" eyebrow="Built-in conversions, customizable">
        <table className="w-full text-sm mb-5">
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

        <form onSubmit={addUnit} className="grid grid-cols-2 md:grid-cols-4 gap-4">
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

      <Panel title="Roles & access" eyebrow="Demo-level, enforced for real by src/data/schema.sql once wired to Supabase">
        <p className="text-sm text-ink-400 mb-3 leading-relaxed">
          The "Viewing as" switcher in the sidebar changes which modules are visible, so you
          can walk through what each role would see. This is a UI convenience for now — real
          access control (a supply officer physically unable to touch sales data) needs actual
          login, which means connecting this app to a backend such as Supabase. The full schema
          and row-level security policies for every role below are already written and ready to
          run — see <code className="chip">src/data/schema.sql</code>.
        </p>
        <ul className="text-sm text-ink-300 space-y-1">
          {ROLES.map((r) => <li key={r.id} className="chip">{r.label}</li>)}
        </ul>
      </Panel>

      <Panel title="Data" eyebrow="Everything is stored in this browser only">
        <p className="text-sm text-ink-400 mb-3">Fabrica keeps all records in your browser's local storage — nothing leaves the device this is opened on. Wipe and reload the example dataset if you want to start over.</p>
        <button className={btnGhostCls} onClick={() => { if (confirm("Reset all data back to the example dataset? This can't be undone.")) resetToSeed(); }}>Reset to example data</button>
      </Panel>
    </div>
  );
}
