import { useState } from "react";
import { useApp, useMoney } from "../lib/AppContext";
import { materialLedger, productionRunCosts, suggestInputsForOutputs, estimateIngredientAllocation } from "../lib/calc";
import { allUnits, toBase, formatQuantity } from "../lib/uom";
import Panel from "../components/Panel";
import { Field, inputCls, btnCls, btnGhostCls } from "../components/Field";

const blankInput = { itemName: "", quantity: "", unit: "kg" };
const blankOutput = { productId: "" };
const overheadPresets = ["Electricity", "Water", "Fuel / gas", "Maintenance", "Packaging", "Other"];

export default function Production() {
  const { data, add, update, remove, addIngredientToRecipe } = useApp();
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
  const [expandedRun, setExpandedRun] = useState(null);
  const [addingOutputTo, setAddingOutputTo] = useState(null);
  const [extraOutput, setExtraOutput] = useState({ productId: "" });
  const [formError, setFormError] = useState("");

  const ledger = materialLedger(data);
  const ledgerByItem = Object.fromEntries(ledger.map((m) => [m.itemName, m]));
  const allKnownMaterials = [...new Set([
    ...ledger.map((m) => m.itemName),
    ...data.products.flatMap((p) => p.ingredients.map((i) => i.itemName)),
  ])];
  const units = allUnits(data.customUnits);
  const productById = Object.fromEntries(data.products.map((s) => [s.id, s]));

  const updateRow = (rows, setRows, i, patch) => setRows(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const applyRecipeSuggestion = (nextOutputs) => {
    if (inputsTouched) return; // don't clobber manual edits
    const suggested = suggestInputsForOutputs(nextOutputs.filter((o) => o.productId), productById);
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
    addIngredientToRecipe(target.productId, input.itemName);
  };

  const addOutputToRun = (run) => {
    if (!extraOutput.productId) return;
    update("productionRuns", run.id, {
      outputs: [...run.outputs, { productId: extraOutput.productId, unit: "unit" }],
    });
    setExtraOutput({ productId: "" });
    setAddingOutputTo(null);
  };

  const setCountedQuantity = (run, index, value) => {
    if (value === "" || value === null) return;
    const nextOutputs = run.outputs.map((o, i) => (i === index ? { ...o, countedQuantity: parseFloat(value) || 0 } : o));
    update("productionRuns", run.id, { outputs: nextOutputs });
  };

  const checkStockAvailability = () => {
    // Sum requested quantity per material (in its base unit), in case the
    // same material appears on more than one row, then compare each
    // material's total against what's actually left in stock right now.
    const requestedBaseByItem = {};
    for (const row of inputs) {
      if (!row.itemName || !row.quantity) continue;
      const qtyBase = toBase(parseFloat(row.quantity) || 0, row.unit, data.customUnits);
      requestedBaseByItem[row.itemName] = (requestedBaseByItem[row.itemName] || 0) + qtyBase;
    }
    const violations = [];
    for (const [itemName, requestedBase] of Object.entries(requestedBaseByItem)) {
      const ledgerRow = ledgerByItem[itemName];
      const remaining = ledgerRow?.remainingBase || 0;
      const baseUnit = ledgerRow?.baseUnit || "";
      if (requestedBase > remaining + 1e-9) {
        violations.push(
          `${itemName} exceeds what's in stock — you're using ${requestedBase.toFixed(2)}${baseUnit} but only ${remaining.toFixed(2)}${baseUnit} is available.`
        );
      }
    }
    return violations;
  };

  const submit = (e) => {
    e.preventDefault();
    setFormError("");
    const violations = checkStockAvailability();
    if (violations.length > 0) {
      setFormError(violations.join(" "));
      return;
    }
    add("productionRuns", {
      batchCode: batchCode || `PRD-${Math.floor(Math.random() * 9000 + 1000)}`,
      date,
      inputs: inputs.filter((i) => i.itemName).map((i) => ({ ...i, quantity: parseFloat(i.quantity) || 0 })),
      outputs: outputs.filter((o) => o.productId).map((o) => ({ productId: o.productId, unit: "unit" })),
      laborCost: parseFloat(laborCost) || 0,
      overheadCosts: overheads.filter((o) => o.category && o.cost).map((o) => ({ category: o.category, cost: parseFloat(o.cost) || 0 })),
      notes,
    });
    setBatchCode(""); setInputs([{ ...blankInput }]); setInputsTouched(false);
    setOutputs([{ ...blankOutput }]); setLaborCost(""); setOverheads([{ category: "Electricity", cost: "" }]);
    setNotes(""); setFormError(""); setOpen(false);
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
        <Panel title="New production run" eyebrow="Pick products first — their ingredient lists suggest the materials below">
          <form onSubmit={submit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <Field label="Batch code"><input className={inputCls} value={batchCode} onChange={(e) => setBatchCode(e.target.value)} placeholder="auto if blank" /></Field>
              <Field label="Date"><input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
              <Field label="Labor cost"><input type="number" step="0.01" className={inputCls} value={laborCost} onChange={(e) => setLaborCost(e.target.value)} /></Field>
            </div>

            <div>
              <div className="chip text-ink-400 uppercase mb-2">Products this run is producing (this run can yield several, in different flavors or sizes) — quantities are entered later via physical count, not here</div>
              <div className="space-y-2 overflow-x-auto">
                {outputs.map((row, i) => (
                  <div key={i} className="grid grid-cols-8 gap-2 items-center min-w-[500px]">
                    <select className={`${inputCls} col-span-7`} value={row.productId} onChange={(e) => onOutputChange(i, { productId: e.target.value })}>
                      <option value="">Product…</option>
                      {data.products.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.flavor} · {p.packSize}</option>)}
                    </select>
                    <button type="button" className="text-ink-500 hover:text-[var(--accent)] text-xs" onClick={() => setOutputs(outputs.filter((_, idx) => idx !== i))}>remove</button>
                  </div>
                ))}
              </div>
              <button type="button" className={`${btnGhostCls} mt-2`} onClick={() => setOutputs([...outputs, { ...blankOutput }])}>+ add product</button>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <div className="chip text-ink-400 uppercase">Materials actually used — enter real quantities; the system will estimate the split per product</div>
                {inputsTouched && (
                  <button type="button" className="chip text-[var(--accent)]" onClick={() => { setInputsTouched(false); applyRecipeSuggestion(outputs); }}>re-sync from recipe</button>
                )}
              </div>
              <div className="space-y-2 overflow-x-auto">
                {inputs.map((row, i) => (
                  <div key={i} className="grid grid-cols-8 gap-2 items-center min-w-[600px]">
                    <select className={`${inputCls} col-span-3`} value={row.itemName} onChange={(e) => { updateRow(inputs, setInputs, i, { itemName: e.target.value }); setInputsTouched(true); setFormError(""); }}>
                      <option value="">Material…</option>
                      {allKnownMaterials.map((name) => (
                        <option key={name} value={name}>
                          {ledgerByItem[name] ? `${name} (${formatQuantity(ledgerByItem[name].remainingBase, ledgerByItem[name].baseUnit)} left)` : `${name} (not yet supplied)`}
                        </option>
                      ))}
                    </select>
                    <input type="number" step="0.01" className={`${inputCls} col-span-2`} placeholder="qty used" value={row.quantity} onChange={(e) => { updateRow(inputs, setInputs, i, { quantity: e.target.value }); setInputsTouched(true); setFormError(""); }} />
                    <select className={`${inputCls} col-span-2`} value={row.unit} onChange={(e) => { updateRow(inputs, setInputs, i, { unit: e.target.value }); setInputsTouched(true); setFormError(""); }}>
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

            {formError && (
              <div className="chip px-3 py-2 rounded border border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]">
                ⚠ {formError}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button type="button" className={btnGhostCls} onClick={() => setOpen(false)}>Cancel</button>
              <button type="submit" className={btnCls}>Save run</button>
            </div>
          </form>
        </Panel>
      )}

      <Panel title="Run log" eyebrow="Materials are locked once saved — you can still add products this run yielded, and log a physical count against each">
        <p className="text-xs text-ink-500 mb-3 -mt-1">
          Physical count is optional and doesn't change recorded costs or margins — it's a
          side-by-side check. A variance between what was logged and what was actually counted
          on the shelf is a signal worth investigating, not an automatic correction.
        </p>
        <div className="space-y-4">
          {[...data.productionRuns].reverse().map((run) => {
            const { totalRunCost, outputs: outs, materialCost, overheadTotal } = productionRunCosts(run, ledger, productById);
            const isExpanded = expandedRun === run.id;
            const allocation = isExpanded ? estimateIngredientAllocation(run, productById) : null;
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
                    <button className="text-ink-500 hover:text-[var(--accent)] text-xs" onClick={() => { if (confirm(`Remove production run ${run.batchCode}? This can't be undone.`)) remove("productionRuns", run.id); }}>remove</button>
                  </div>
                </div>
                {run.overheadCosts?.length > 0 && (
                  <div className="chip text-ink-500 mb-2">
                    {run.overheadCosts.map((o) => `${o.category}: ${money(o.cost)}`).join("  ·  ")}
                  </div>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm mt-2" style={{ minWidth: "560px" }}>
                    <thead>
                      <tr className="text-left chip text-ink-500 uppercase border-b border-ink-700">
                        <th className="py-1.5 pr-4">Product</th>
                        <th className="py-1.5 pr-4 text-right">Physical count</th>
                        <th className="py-1.5 pr-4 text-right">Cost allocated</th>
                        <th className="py-1.5 pr-4 text-right">Cost / unit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {outs.map((o, idx) => {
                        const isLegacy = run.outputs[idx]?.quantity !== undefined && run.outputs[idx]?.countedQuantity === undefined;
                        return (
                          <tr key={o.productId + idx} className="text-ink-200">
                            <td className="py-1.5 pr-4">{o.product?.name} · {o.product?.packSize}</td>
                            <td className="py-1.5 pr-4 text-right">
                              <PhysicalCountCell
                                output={run.outputs[idx]}
                                isLegacy={isLegacy}
                                onSave={(value) => setCountedQuantity(run, idx, value)}
                              />
                            </td>
                            <td className="py-1.5 pr-4 text-right chip">{o.isCounted || isLegacy ? money(o.costAllocated) : "—"}</td>
                            <td className="py-1.5 pr-4 text-right chip text-brass-400">{o.isCounted || isLegacy ? money(o.costPerUnit) : "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>


                {addingOutputTo === run.id ? (
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    <select className={`${inputCls} w-56`} value={extraOutput.productId} onChange={(e) => setExtraOutput({ ...extraOutput, productId: e.target.value })}>
                      <option value="">Product…</option>
                      {data.products.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.packSize}</option>)}
                    </select>
                    <button className="chip text-[var(--accent)]" onClick={() => addOutputToRun(run)}>save</button>
                    <button className="chip text-ink-500" onClick={() => { setAddingOutputTo(null); setExtraOutput({ productId: "" }); }}>cancel</button>
                  </div>
                ) : (
                  <button className={`${btnGhostCls} mt-3`} onClick={() => setAddingOutputTo(run.id)}>+ add a product this run also yielded</button>
                )}
                <button
                  className="chip text-[var(--accent)] mt-3"
                  onClick={() => setExpandedRun(isExpanded ? null : run.id)}
                >
                  {isExpanded ? "Hide" : "Show"} estimated ingredient usage per product
                </button>
                {isExpanded && allocation && (
                  <div className="mt-3 border-t border-ink-700 pt-3 overflow-x-auto">
                    <table className="w-full text-sm" style={{ minWidth: "500px" }}>
                      <thead>
                        <tr className="text-left chip text-ink-500 uppercase border-b border-ink-700">
                          <th className="py-1.5 pr-4">Material</th>
                          <th className="py-1.5 pr-4">Estimated split</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(allocation).map(([itemName, rows]) => (
                          <tr key={itemName} className="text-ink-200 align-top">
                            <td className="py-1.5 pr-4">{itemName}</td>
                            <td className="py-1.5 pr-4">
                              {rows.map((r) => (
                                <div key={r.productId} className="chip text-ink-300">
                                  {r.product?.name} ({r.product?.packSize}): {r.quantity.toFixed(2)} {r.unit}
                                </div>
                              ))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="text-xs text-ink-500 mt-2">
                      Estimated by splitting each material across the products that list it as an
                      ingredient, proportional to how much of each was produced in this run — not
                      a direct measurement.
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

function PhysicalCountCell({ output, isLegacy, onSave }) {
  const [draft, setDraft] = useState("");

  if (output.countedQuantity !== undefined) {
    return <span className="chip text-moss-400">{output.countedQuantity} · locked ✓</span>;
  }
  if (isLegacy) {
    return <span className="chip text-ink-400">{output.quantity} · logged</span>;
  }
  return (
    <div className="flex items-center justify-end gap-2">
      <input
        type="number" placeholder="count"
        className="chip w-20 bg-ink-900 border border-ink-700 rounded px-2 py-1 text-right text-ink-100 focus:outline-none focus:border-[var(--accent)]"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
      />
      <button
        type="button"
        className="chip text-[var(--accent)]"
        onClick={() => {
          if (draft === "") return;
          if (confirm(`Save ${draft} as the physical count? This can't be changed once saved.`)) onSave(draft);
        }}
      >
        save
      </button>
    </div>
  );
}
