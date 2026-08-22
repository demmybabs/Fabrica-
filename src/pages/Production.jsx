import { useState } from "react";
import { useApp } from "../lib/AppContext";
import { materialLedger, productionRunCosts } from "../lib/calc";
import { allUnits } from "../lib/uom";
import Panel from "../components/Panel";
import { Field, inputCls, btnCls, btnGhostCls } from "../components/Field";

function money(n) {
  return `$${(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const blankInput = { itemName: "", quantity: "", unit: "kg" };
const blankOutput = { skuId: "", quantity: "" };

export default function Production() {
  const { data, add, remove } = useApp();
  const [open, setOpen] = useState(false);
  const [batchCode, setBatchCode] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [inputs, setInputs] = useState([{ ...blankInput }]);
  const [outputs, setOutputs] = useState([{ ...blankOutput }]);
  const [laborCost, setLaborCost] = useState("");
  const [overheadCost, setOverheadCost] = useState("");
  const [notes, setNotes] = useState("");

  const ledger = materialLedger(data);
  const units = allUnits(data.customUnits);
  const skuById = Object.fromEntries(data.skus.map((s) => [s.id, s]));

  const updateRow = (rows, setRows, i, patch) => {
    setRows(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  };

  const submit = (e) => {
    e.preventDefault();
    add("productionRuns", {
      batchCode: batchCode || `PRD-${Math.floor(Math.random() * 9000 + 1000)}`,
      date,
      inputs: inputs.filter((i) => i.itemName).map((i) => ({ ...i, quantity: parseFloat(i.quantity) || 0 })),
      outputs: outputs.filter((o) => o.skuId).map((o) => ({ ...o, unit: "unit", quantity: parseFloat(o.quantity) || 0 })),
      laborCost: parseFloat(laborCost) || 0,
      overheadCost: parseFloat(overheadCost) || 0,
      notes,
    });
    setBatchCode(""); setInputs([{ ...blankInput }]); setOutputs([{ ...blankOutput }]);
    setLaborCost(""); setOverheadCost(""); setNotes(""); setOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="chip text-ink-400 uppercase">Module 02</div>
          <h1 className="font-display text-xl font-semibold text-ink-50">Production</h1>
        </div>
        <button className={btnCls} onClick={() => setOpen((o) => !o)}>{open ? "Cancel" : "+ Log a run"}</button>
      </div>

      {open && (
        <Panel title="New production run" eyebrow="One batch, one or more SKUs out">
          <form onSubmit={submit} className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Field label="Batch code"><input className={inputCls} value={batchCode} onChange={(e) => setBatchCode(e.target.value)} placeholder="auto if blank" /></Field>
              <Field label="Date"><input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
              <Field label="Labor cost"><input type="number" step="0.01" className={inputCls} value={laborCost} onChange={(e) => setLaborCost(e.target.value)} /></Field>
              <Field label="Overhead cost"><input type="number" step="0.01" className={inputCls} value={overheadCost} onChange={(e) => setOverheadCost(e.target.value)} /></Field>
            </div>

            <div>
              <div className="chip text-ink-400 uppercase mb-2">Materials taken from supply</div>
              <div className="space-y-2">
                {inputs.map((row, i) => (
                  <div key={i} className="grid grid-cols-8 gap-2 items-center">
                    <select className={`${inputCls} col-span-3`} value={row.itemName} onChange={(e) => updateRow(inputs, setInputs, i, { itemName: e.target.value })}>
                      <option value="">Material…</option>
                      {ledger.map((m) => <option key={m.itemName} value={m.itemName}>{m.itemName} ({m.remainingBase.toFixed(1)} {m.baseUnit} left)</option>)}
                    </select>
                    <input type="number" step="0.01" className={`${inputCls} col-span-2`} placeholder="qty" value={row.quantity} onChange={(e) => updateRow(inputs, setInputs, i, { quantity: e.target.value })} />
                    <select className={`${inputCls} col-span-2`} value={row.unit} onChange={(e) => updateRow(inputs, setInputs, i, { unit: e.target.value })}>
                      {units.map((u) => <option key={u.unit} value={u.unit}>{u.unit}</option>)}
                    </select>
                    <button type="button" className="text-ink-500 hover:text-rust-400 text-xs" onClick={() => setInputs(inputs.filter((_, idx) => idx !== i))}>remove</button>
                  </div>
                ))}
              </div>
              <button type="button" className={`${btnGhostCls} mt-2`} onClick={() => setInputs([...inputs, { ...blankInput }])}>+ add material</button>
            </div>

            <div>
              <div className="chip text-ink-400 uppercase mb-2">SKUs produced (this run can yield several)</div>
              <div className="space-y-2">
                {outputs.map((row, i) => (
                  <div key={i} className="grid grid-cols-8 gap-2 items-center">
                    <select className={`${inputCls} col-span-5`} value={row.skuId} onChange={(e) => updateRow(outputs, setOutputs, i, { skuId: e.target.value })}>
                      <option value="">SKU…</option>
                      {data.skus.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.flavor} · {s.packSize}</option>)}
                    </select>
                    <input type="number" step="1" className={`${inputCls} col-span-2`} placeholder="units out" value={row.quantity} onChange={(e) => updateRow(outputs, setOutputs, i, { quantity: e.target.value })} />
                    <button type="button" className="text-ink-500 hover:text-rust-400 text-xs" onClick={() => setOutputs(outputs.filter((_, idx) => idx !== i))}>remove</button>
                  </div>
                ))}
              </div>
              <button type="button" className={`${btnGhostCls} mt-2`} onClick={() => setOutputs([...outputs, { ...blankOutput }])}>+ add SKU</button>
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
            const { totalRunCost, outputs: outs, materialCost } = productionRunCosts(run, ledger, skuById);
            return (
              <div key={run.id} className="border border-ink-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="chip bg-ink-900 border border-ink-700 rounded px-2 py-0.5 text-brass-400">{run.batchCode}</span>
                    <span className="chip text-ink-500">{run.date}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="chip text-ink-400">materials {money(materialCost)} · labor {money(run.laborCost)} · overhead {money(run.overheadCost)}</span>
                    <span className="chip text-rust-400">total {money(totalRunCost)}</span>
                    <button className="text-ink-500 hover:text-rust-400 text-xs" onClick={() => remove("productionRuns", run.id)}>remove</button>
                  </div>
                </div>
                <table className="w-full text-sm mt-2">
                  <thead>
                    <tr className="text-left chip text-ink-500 uppercase border-b border-ink-700">
                      <th className="py-1.5 pr-4">SKU</th>
                      <th className="py-1.5 pr-4 text-right">Units out</th>
                      <th className="py-1.5 pr-4 text-right">Cost allocated</th>
                      <th className="py-1.5 pr-4 text-right">Cost / unit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {outs.map((o) => (
                      <tr key={o.skuId} className="text-ink-200">
                        <td className="py-1.5 pr-4">{o.sku?.name} · {o.sku?.packSize}</td>
                        <td className="py-1.5 pr-4 text-right chip">{o.quantity}</td>
                        <td className="py-1.5 pr-4 text-right chip">{money(o.costAllocated)}</td>
                        <td className="py-1.5 pr-4 text-right chip text-brass-400">{money(o.costPerUnit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
