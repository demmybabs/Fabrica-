import { useState } from "react";
import { useApp, useMoney } from "../lib/AppContext";
import { materialLedger } from "../lib/calc";
import { allUnits } from "../lib/uom";
import Panel from "../components/Panel";
import { Field, inputCls, btnCls, btnGhostCls } from "../components/Field";

const blank = { supplierId: "", itemName: "", quantity: "", unit: "kg", unitCost: "", dateReceived: "", amountPaid: "", notes: "" };

export default function Supply() {
  const { data, add, remove } = useApp();
  const money = useMoney();
  const [form, setForm] = useState(blank);
  const [open, setOpen] = useState(false);
  const ledger = materialLedger(data);
  const units = allUnits(data.customUnits);
  const supplierById = Object.fromEntries(data.suppliers.map((s) => [s.id, s]));

  const submit = (e) => {
    e.preventDefault();
    const quantity = parseFloat(form.quantity) || 0;
    const unitCost = parseFloat(form.unitCost) || 0;
    add("supplyBatches", {
      ...form,
      quantity,
      unitCost,
      totalCost: quantity * unitCost,
      amountPaid: parseFloat(form.amountPaid) || 0,
      dateReceived: form.dateReceived || new Date().toISOString().slice(0, 10),
    });
    setForm(blank);
    setOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="chip text-ink-400 uppercase">Module 01</div>
          <h1 className="font-display text-xl font-semibold text-ink-50">Supply</h1>
        </div>
        <button className={btnCls} onClick={() => setOpen((o) => !o)}>{open ? "Cancel" : "+ Log a delivery"}</button>
      </div>

      {open && (
        <Panel title="New delivery" eyebrow="Supply intake">
          <form onSubmit={submit} className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Field label="Supplier">
              <select className={inputCls} value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })} required>
                <option value="">Select…</option>
                {data.suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            <Field label="Item / material">
              <input className={inputCls} value={form.itemName} onChange={(e) => setForm({ ...form, itemName: e.target.value })} placeholder="e.g. Rolled oats" required />
            </Field>
            <Field label="Quantity">
              <input type="number" step="0.01" className={inputCls} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required />
            </Field>
            <Field label="Unit">
              <select className={inputCls} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                {units.map((u) => <option key={u.unit} value={u.unit}>{u.unit}</option>)}
              </select>
            </Field>
            <Field label="Unit cost">
              <input type="number" step="0.01" className={inputCls} value={form.unitCost} onChange={(e) => setForm({ ...form, unitCost: e.target.value })} required />
            </Field>
            <Field label="Amount paid so far">
              <input type="number" step="0.01" className={inputCls} value={form.amountPaid} onChange={(e) => setForm({ ...form, amountPaid: e.target.value })} />
            </Field>
            <Field label="Date received">
              <input type="date" className={inputCls} value={form.dateReceived} onChange={(e) => setForm({ ...form, dateReceived: e.target.value })} />
            </Field>
            <Field label="Notes">
              <input className={inputCls} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Field>
            <div className="col-span-2 md:col-span-4 flex justify-end gap-2 pt-1">
              <button type="button" className={btnGhostCls} onClick={() => setOpen(false)}>Cancel</button>
              <button type="submit" className={btnCls}>Save delivery</button>
            </div>
          </form>
        </Panel>
      )}

      <Panel title="Materials ledger" eyebrow="What's on hand, per material">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left chip text-ink-500 uppercase border-b border-ink-700">
              <th className="py-2 pr-4">Material</th>
              <th className="py-2 pr-4 text-right">Supplied</th>
              <th className="py-2 pr-4 text-right">Consumed</th>
              <th className="py-2 pr-4 text-right">Remaining</th>
              <th className="py-2 pr-4 text-right">Avg cost / {"{base}"}</th>
              <th className="py-2 pr-4 text-right">Value remaining</th>
              <th className="py-2 pr-4 text-right">Payable</th>
            </tr>
          </thead>
          <tbody>
            {ledger.map((r) => (
              <tr key={r.itemName} className="border-b border-ink-700/60 text-ink-200">
                <td className="py-2 pr-4">{r.itemName}</td>
                <td className="py-2 pr-4 text-right chip">{r.suppliedBase.toFixed(1)} {r.baseUnit}</td>
                <td className="py-2 pr-4 text-right chip">{r.consumedBase.toFixed(1)} {r.baseUnit}</td>
                <td className="py-2 pr-4 text-right chip text-brass-400">{r.remainingBase.toFixed(1)} {r.baseUnit}</td>
                <td className="py-2 pr-4 text-right chip">{money(r.avgUnitCostBase)}</td>
                <td className="py-2 pr-4 text-right chip">{money(r.valueRemaining)}</td>
                <td className="py-2 pr-4 text-right chip text-rust-400">{r.payable > 0 ? money(r.payable) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Panel title="Delivery log" eyebrow="Every batch received">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left chip text-ink-500 uppercase border-b border-ink-700">
              <th className="py-2 pr-4">Date</th>
              <th className="py-2 pr-4">Supplier</th>
              <th className="py-2 pr-4">Item</th>
              <th className="py-2 pr-4 text-right">Qty</th>
              <th className="py-2 pr-4 text-right">Total cost</th>
              <th className="py-2 pr-4 text-right">Paid</th>
              <th className="py-2 pr-4"></th>
            </tr>
          </thead>
          <tbody>
            {[...data.supplyBatches].reverse().map((b) => (
              <tr key={b.id} className="border-b border-ink-700/60 text-ink-200">
                <td className="py-2 pr-4 chip">{b.dateReceived}</td>
                <td className="py-2 pr-4">{supplierById[b.supplierId]?.name || "—"}</td>
                <td className="py-2 pr-4">{b.itemName}</td>
                <td className="py-2 pr-4 text-right chip">{b.quantity} {b.unit}</td>
                <td className="py-2 pr-4 text-right chip">{money(b.totalCost)}</td>
                <td className="py-2 pr-4 text-right chip">{money(b.amountPaid)}</td>
                <td className="py-2 pr-4 text-right">
                  <button className="text-ink-500 hover:text-rust-400 text-xs" onClick={() => remove("supplyBatches", b.id)}>remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
