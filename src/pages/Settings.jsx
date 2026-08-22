import { useState } from "react";
import { useApp } from "../lib/AppContext";
import { DEFAULT_UNITS } from "../lib/uom";
import Panel from "../components/Panel";
import { Field, inputCls, btnCls, btnGhostCls } from "../components/Field";

const blank = { category: "weight", unit: "", baseFactor: "" };

export default function Settings() {
  const { data, setCustomUnits, resetToSeed } = useApp();
  const [form, setForm] = useState(blank);

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
                    <button className="ml-3 text-ink-500 hover:text-rust-400 text-xs" onClick={() => removeUnit(cat, unit)}>remove</button>
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

      <Panel title="Data" eyebrow="Everything is stored in this browser only">
        <p className="text-sm text-ink-400 mb-3">Fabrica keeps all records in your browser's local storage — nothing leaves the device this is opened on. Wipe and reload the example dataset if you want to start over.</p>
        <button className={btnGhostCls} onClick={() => { if (confirm("Reset all data back to the example dataset? This can't be undone.")) resetToSeed(); }}>Reset to example data</button>
      </Panel>
    </div>
  );
}
