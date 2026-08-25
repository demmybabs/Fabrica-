import { useState } from "react";
import { useApp, useMoney } from "../lib/AppContext";
import { materialLedger, productionRunCosts, suggestInputsForOutputs } from "../lib/calc";
import { allUnits } from "../lib/uom";
import Panel from "../components/Panel";
import { Field, inputCls, btnCls, btnGhostCls } from "../components/Field";

const blankInput = { itemName: "", quantity: "", unit: "kg" };
const blankOutput = { productId: "", quantity: "" };
const overheadPresets = ["Electricity", "Water", "Fuel / gas", "Maintenance", "Packaging", "Other"];

export default function Production() {
  const { data, add, remove, addIngredientToRecipe } = useApp();
  const money = useMoney();
  const [open, setOpen] = useState(false);
  const [batchCode, setBatchCode] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [inputs, setInputs] = useState([{ ...blankInput }]);
  const [inputsTouched, setInputsTouched] = useState(false);
  const [outputs, setOutputs] = useState([{ ...blankOutput }]);
  const [laborCost, setLaborCost] = useState("");
  const [overheads, setOverheads] = useState([{ category: "Electricity", cost: "" }]);
  const [notes, setNotes] = useState("");

  const ledger = materialLedger(data);
  const units = allUnits(data.customUnits);
  const productById = Object.fromEntries(data.products.map((s) => [s.id, s]));

  const updateRow = (rows, setRows, i, patch) => setRows(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const applyRecipeSuggestion = (nextOutputs) => {
    if (inputsTouched) return; // don't clobber manual edits
    const suggested = suggestInputsForOutputs(
      nextOutputs.filter((o) => o.productId && o.quantity),
      productById
    );
    if (suggested.length > 0) setInputs(suggested);
  };

  const onOutputChange = (i, patch) => {
    const next = outputs.map((r, idx) => (idx === i ? { ...r, ...patch } : r));
    setOutputs(next);
    applyRecipeSuggestion(next);
  };

  const recipeItemNames = (o) => new Set((productById[o.productId]?.ingredients || []).map((ing) => ing.itemName));
  const inputIsOffRecipe = (input) => {
    const usedProducts = outputs.filter((o) => o.productId);
    if (usedProducts.length === 0) return false;
    return !usedProducts.some((o) => recipeItemNames(o).has(input.itemName));
  };

  const saveInputToRecipe = (input) => {
    const target = outputs.find((o) => o.productId);
    if (!target) return;
    const outputQty = parseFloat(target.quantity) || 1;
    addIngredientToRecipe(target.productId, {
      itemName: input.itemName,
      quantityPerUnit: (parseFloat(input.quantity) || 0) / outputQty,
      unit: input.unit,
    });
  };

  const submit = (e) => {
    e.preventDefault();
    add("productionRuns", {
      batchCode: batchCode || `PRD-${Math.floor(Math.random() * 9000 + 1000)}`,
      date,
      inputs: inputs.filter((i) => i.itemName).map((i) => ({ ...i, quantity: parseFloat(i.quantity) || 0 })),
      outputs: outputs.filter((o) => o.productId).map((o) => ({ ...o, unit: "unit", quantity: parseFloat(o.quantity) || 0 })),
      laborCost: parseFloat(laborCost) || 0,
      overheadCosts: overheads.filter((o) => o.category && o.cost).map((o) => ({ category: o.category, cost: parseFloat(o.cost) || 0 })),
      notes,
    });
    setBatchCode(""); setInputs([{ ...blankInput }]); setInputsTouched(false);
    setOutputs([{ ...blankOutput }]); setLaborCost(""); setOverheads([{ category: "Electricity", cost: "" }]);
    setNotes(""); setOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="chip text-ink-400 uppercase">Module 02</div>
          <h1 className="font-display text-xl font-semibold text-ink-50">Production</h1>
          <p className="text-sm text-ink-400 mt-1 max-w-lg">Log a batch: pick what you're making, materials auto-fill from the recipe, cost is split across every product it yields.</p>
        </div>
        <button className={btnCls} onClick={() => setOpen((o) => !o)}>{open ? "Cancel" : "+ Log a run"}</button>
      </div>

      {open && (
        <Panel title="New production run" eyebrow="Pick products first — materials auto-fill from their recipe">
          <form onSubmit={submit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <Field label="Batch code"><input className={inputCls} value={batchCode} onChange={(e) => setBatchCode(e.target.value)} placeholder="auto if blank" /></Field>
              <Field label="Date"><input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
              <Field label="Labor cost"><input type="number" step="0.01" className={inputCls} value={laborCost} onChange={(e) => setLaborCost(e.target.value)} /></Field>
            </div>

            <div>
              <div className="chip text-ink-400 uppercase mb-2">Products produced (this run can yield several, in different flavors or sizes)</div>
              <div className="space-y-2 overflow-x-auto">
                {outputs.map((row, i) => (
                  <div key={i} className="grid grid-cols-8 gap-2 items-center min-w-[600px]">
                    <select className={`${inputCls} col-span-5`} value={row.productId} onChange={(e) => onOutputChange(i, { productId: e.target.value })}>
                      <option value="">Product…</option>
                      {data.products.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.flavor} · {p.packSize}</option>)}
                    </select>
                    <input type="number" step="1" className={`${inputCls} col-span-2`} placeholder="units out" value={row.quantity} onChange={(e) => onOutputChange(i, { quantity: e.target.value })} />
                    <button type="button" className="text-ink-500 hover:text-[var(--accent)] text-xs" onClick={() => setOutputs(outputs.filter((_, idx) => idx !== i))}>remove</button>
                  </div>
                ))}
              </div>
              <button type="button" className={`${btnGhostCls} mt-2`} onClick={() => setOutputs([...outputs, { ...blankOutput }])}>+ add product</button>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="chip text-ink-400 uppercase">Materials taken from supply — auto-filled from the recipe(s) above, editable</div>
                {inputsTouched && (
                  <button type="button" className="chip text-[var(--accent)]" onClick={() => { setInputsTouched(false); applyRecipeSuggestion(outputs); }}>re-sync from recipe</button>
                )}
              </div>
              <div className="space-y-2 overflow-x-auto">
                {inputs.map((row, i) => (
                  <div key={i} className="grid grid-cols-8 gap-2 items-center min-w-[600px]">
                    <select className={`${inputCls} col-span-3`} value={row.itemName} onChange={(e) => { updateRow(inputs, setInputs, i, { itemName: e.target.value }); setInputsTouched(true); }}>
                      <option value="">Material…</option>
                      {ledger.map((m) => <option key={m.itemName} value={m.itemName}>{m.itemName} ({m.remainingBase.toFixed(1)} {m.baseUnit} left)</option>)}
                    </select>
                    <input type="number" step="0.01" className={`${inputCls} col-span-2`} placeholder="qty" value={row.quantity} onChange={(e) => { updateRow(inputs, setInputs, i, { quantity: e.target.value }); setInputsTouched(true); }} />
                    <select className={`${inputCls} col-span-2`} value={row.unit} onChange={(e) => { updateRow(inputs, setInputs, i, { unit: e.target.value }); setInputsTouched(true); }}>
                      {units.map((u) => <option key={u.unit} value={u.unit}>{u.unit}</option>)}
                    </select>
                    {row.itemName && inputIsOffRecipe(row) ? (
                      <button type="button" className="chip text-[var(--accent)] text-[10px]" onClick={() => saveInputToRecipe(row)}>save to recipe</button>
                    ) : (
                      <button type="button" className="text-ink-500 hover:text-[var(--accent)] text-xs" onClick={() => { setInputs(inputs.filter((_, idx) => idx !== i)); setInputsTouched(true); }}>remove</button>
                    )}
                  </div>
                ))}
              </div>
              <button type="button" className={`${btnGhostCls} mt-2`} onClick={() => { setInputs([...inputs, { ...blankInput }]); setInputsTouched(true); }}>+ add material manually</button>
            </div>

            <div>
              <div className="chip text-ink-400 uppercase mb-2">Overhead costs — split by category</div>
              <div className="space-y-2 overflow-x-auto">
                {overheads.map((row, i) => (
                  <div key={i} className="grid grid-cols-8 gap-2 items-center min-w-[600px]">
                    <select className={`${inputCls} col-span-4`} value={row.category} onChange={(e) => updateRow(overheads, setOverheads, i, { category: e.target.value })}>
                      {overheadPresets.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <input type="number" step="0.01" className={`${inputCls} col-span-3`} placeholder="cost" value={row.cost} onChange={(e) => updateRow(overheads, setOverheads, i, { cost: e.target.value })} />
                    <button type="button" className="text-ink-500 hover:text-[var(--accent)] text-xs" onClick={() => setOverheads(overheads.filter((_, idx) => idx !== i))}>remove</button>
                  </div>
                ))}
              </div>
              <button type="button" className={`${btnGhostCls} mt-2`} onClick={() => setOverheads([...overheads, { category: "Other", cost: "" }])}>+ add overhead line</button>
            </div>

            <Field label="Notes"><input className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>

            <div className="flex justify-end gap-2">
              <button type="button" className={btnGhostCls} onClick={() => setOpen(false)}>Cancel</button>
              <button type="submit" className={btnCls}>Save run</button>
            </div>
          </form>
        </Panel>
      )}

      <Panel title="Run log" eyebrow="Cost allocated by pack weight, not split evenly">
        <div className="space-y-4">
          {[...data.productionRuns].reverse().map((run) => {
            const { totalRunCost, outputs: outs, materialCost, overheadTotal } = productionRunCosts(run, ledger, productById);
            return (
              <div key={run.id} className="border border-ink-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <span className="chip bg-ink-900 border border-ink-700 rounded px-2 py-0.5 text-brass-400">{run.batchCode}</span>
                    <span className="chip text-ink-500">{run.date}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="chip text-ink-400">materials {money(materialCost)} · labor {money(run.laborCost)} · overhead {money(overheadTotal)}</span>
                    <span className="chip text-[var(--accent)]">total {money(totalRunCost)}</span>
                    <button className="text-ink-500 hover:text-[var(--accent)] text-xs" onClick={() => remove("productionRuns", run.id)}>remove</button>
                  </div>
                </div>
                {run.overheadCosts?.length > 0 && (
                  <div className="chip text-ink-500 mb-2">
                    {run.overheadCosts.map((o) => `${o.category}: ${money(o.cost)}`).join("  ·  ")}
                  </div>
                )}
                <div className="overflow-x-auto">
<table className="w-full text-sm mt-2" style={{minWidth: "600px"}}>
                  <thead>
                    <tr className="text-left chip text-ink-500 uppercase border-b border-ink-700">
                      <th className="py-1.5 pr-4">Product</th>
                      <th className="py-1.5 pr-4 text-right">Units out</th>
                      <th className="py-1.5 pr-4 text-right">Cost allocated</th>
                      <th className="py-1.5 pr-4 text-right">Cost / unit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {outs.map((o) => (
                      <tr key={o.productId} className="text-ink-200">
                        <td className="py-1.5 pr-4">{o.product?.name} · {o.product?.packSize}</td>
                        <td className="py-1.5 pr-4 text-right chip">{o.quantity}</td>
                        <td className="py-1.5 pr-4 text-right chip">{money(o.costAllocated)}</td>
                        <td className="py-1.5 pr-4 text-right chip text-brass-400">{money(o.costPerUnit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
</div>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
