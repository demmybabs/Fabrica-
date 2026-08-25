import { useState } from "react";
import { useApp, useMoney } from "../lib/AppContext";
import { materialLedger } from "../lib/calc";
import { allUnits } from "../lib/uom";
import Panel from "../components/Panel";
import { Field, inputCls, btnCls, btnGhostCls } from "../components/Field";

const blankSupplier = { name: "", contact: "" };
const blankDelivery = { supplierId: "", itemName: "", quantity: "", unit: "kg", unitCost: "", dateReceived: "", amountPaid: "", notes: "" };

export default function Supply() {
  const { data, add, remove } = useApp();
  const money = useMoney();
  const [openSupplier, setOpenSupplier] = useState(false);
  const [openDelivery, setOpenDelivery] = useState(false);
  const [supplierForm, setSupplierForm] = useState(blankSupplier);
  const [form, setForm] = useState(blankDelivery);

  const ledger = materialLedger(data);
  const units = allUnits(data.customUnits);
  const supplierById = Object.fromEntries(data.suppliers.map((s) => [s.id, s]));
  const batchCountBySupplier = {};
  for (const b of data.supplyBatches) batchCountBySupplier[b.supplierId] = (batchCountBySupplier[b.supplierId] || 0) + 1;

  const submitSupplier = (e) => {
    e.preventDefault();
    add("suppliers", supplierForm);
    setSupplierForm(blankSupplier);
    setOpenSupplier(false);
  };

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
    setForm(blankDelivery);
    setOpenDelivery(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="chip text-ink-400 uppercase">Module 01</div>
          <h1 className="font-display text-xl font-semibold text-ink-50">Supply</h1>
          <p className="text-sm text-ink-400 mt-1 max-w-lg">
            Everyone you buy raw materials from, and every delivery you've received —
            what's on hand and what's still owed comes from this page.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button className={btnGhostCls} onClick={() => setOpenSupplier((o) => !o)}>{openSupplier ? "Cancel" : "+ Onboard a supplier"}</button>
          <button className={btnCls} onClick={() => setOpenDelivery((o) => !o)}>{openDelivery ? "Cancel" : "+ Log a delivery"}</button>
        </div>
      </div>

      {openSupplier && (
        <Panel title="New supplier" eyebrow="Save them once — they'll show up in the delivery form below">
          <form onSubmit={submitSupplier} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Supplier name"><input className={inputCls} value={supplierForm.name} onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })} required /></Field>
            <Field label="Contact (email / phone)"><input className={inputCls} value={supplierForm.contact} onChange={(e) => setSupplierForm({ ...supplierForm, contact: e.target.value })} /></Field>
            <div className="col-span-1 sm:col-span-2 flex justify-end gap-2">
              <button type="button" className={btnGhostCls} onClick={() => setOpenSupplier(false)}>Cancel</button>
              <button type="submit" className={btnCls}>Save supplier</button>
            </div>
          </form>
        </Panel>
      )}

      {openDelivery && (
        <Panel title="New delivery" eyebrow={data.suppliers.length === 0 ? "Onboard a supplier first, then log what they delivered" : "What came in, from whom, and what it cost"}>
          <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
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
            <div className="col-span-1 sm:col-span-2 md:col-span-4 flex justify-end gap-2 pt-1">
              <button type="button" className={btnGhostCls} onClick={() => setOpenDelivery(false)}>Cancel</button>
              <button type="submit" className={btnCls}>Save delivery</button>
            </div>
          </form>
        </Panel>
      )}

      <Panel title="Materials ledger" eyebrow="What's on hand, per material — updates automatically as deliveries and production runs are logged">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="text-left chip text-ink-500 uppercase border-b border-ink-700">
                <th className="py-2 pr-4">Material</th>
                <th className="py-2 pr-4 text-right">Supplied</th>
                <th className="py-2 pr-4 text-right">Consumed</th>
                <th className="py-2 pr-4 text-right">Remaining</th>
                <th className="py-2 pr-4 text-right">Avg cost</th>
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
                  <td className="py-2 pr-4 text-right chip text-[var(--accent)]">{r.payable > 0 ? money(r.payable) : "—"}</td>
                </tr>
              ))}
              {ledger.length === 0 && <tr><td colSpan={7} className="py-6 text-center text-ink-500">No deliveries logged yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Supplier directory" eyebrow="Everyone you buy from">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[480px]">
            <thead>
              <tr className="text-left chip text-ink-500 uppercase border-b border-ink-700">
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Contact</th>
                <th className="py-2 pr-4 text-right">Deliveries logged</th>
                <th className="py-2 pr-4"></th>
              </tr>
            </thead>
            <tbody>
              {data.suppliers.map((s) => (
                <tr key={s.id} className="border-b border-ink-700/60 text-ink-200">
                  <td className="py-2 pr-4">{s.name}</td>
                  <td className="py-2 pr-4 text-ink-400">{s.contact || "—"}</td>
                  <td className="py-2 pr-4 text-right chip">{batchCountBySupplier[s.id] || 0}</td>
                  <td className="py-2 pr-4 text-right"><button className="text-ink-500 hover:text-[var(--accent)] text-xs" onClick={() => remove("suppliers", s.id)}>remove</button></td>
                </tr>
              ))}
              {data.suppliers.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-ink-500">No suppliers yet — onboard your first one above.</td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Delivery log" eyebrow="Every batch received">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
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
                  <td className="py-2 pr-4 text-right"><button className="text-ink-500 hover:text-[var(--accent)] text-xs" onClick={() => remove("supplyBatches", b.id)}>remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
