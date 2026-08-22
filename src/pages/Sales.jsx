import { useState } from "react";
import { useApp } from "../lib/AppContext";
import { salesWithMargin, finishedGoodsInventory } from "../lib/calc";
import Panel from "../components/Panel";
import { Field, inputCls, btnCls, btnGhostCls } from "../components/Field";

function money(n) {
  return `$${(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const paymentModes = ["Cash", "POS", "Transfer", "Credit"];
const blank = { customerId: "", skuId: "", quantity: "", unitPrice: "", paymentMode: "Cash", date: "" };

export default function Sales() {
  const { data, add, remove } = useApp();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blank);

  const sales = salesWithMargin(data);
  const inv = finishedGoodsInventory(data);
  const onHandBySku = Object.fromEntries(inv.map((r) => [r.sku.id, r.qtyOnHand]));

  const submit = (e) => {
    e.preventDefault();
    add("sales", {
      ...form,
      quantity: parseFloat(form.quantity) || 0,
      unitPrice: parseFloat(form.unitPrice) || 0,
      unit: "unit",
      date: form.date || new Date().toISOString().slice(0, 10),
    });
    setForm(blank); setOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="chip text-ink-400 uppercase">Module 04</div>
          <h1 className="font-display text-xl font-semibold text-ink-50">Sales</h1>
        </div>
        <button className={btnCls} onClick={() => setOpen((o) => !o)}>{open ? "Cancel" : "+ Record a sale"}</button>
      </div>

      {open && (
        <Panel title="New sale" eyebrow="Draws directly from inventory on hand">
          <form onSubmit={submit} className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Field label="Customer">
              <select className={inputCls} value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })} required>
                <option value="">Select…</option>
                {data.customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="SKU">
              <select className={inputCls} value={form.skuId} onChange={(e) => setForm({ ...form, skuId: e.target.value })} required>
                <option value="">Select…</option>
                {data.skus.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.packSize} — {onHandBySku[s.id] ?? 0} on hand</option>)}
              </select>
            </Field>
            <Field label="Quantity"><input type="number" className={inputCls} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required /></Field>
            <Field label="Unit price"><input type="number" step="0.01" className={inputCls} value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: e.target.value })} required /></Field>
            <Field label="Payment mode">
              <select className={inputCls} value={form.paymentMode} onChange={(e) => setForm({ ...form, paymentMode: e.target.value })}>
                {paymentModes.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="Date"><input type="date" className={inputCls} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
            <div className="col-span-2 md:col-span-3 flex justify-end gap-2">
              <button type="button" className={btnGhostCls} onClick={() => setOpen(false)}>Cancel</button>
              <button type="submit" className={btnCls}>Save sale</button>
            </div>
          </form>
        </Panel>
      )}

      <Panel title="Sales log" eyebrow="Cost per unit is the current weighted-average from production">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left chip text-ink-500 uppercase border-b border-ink-700">
              <th className="py-2 pr-4">Date</th>
              <th className="py-2 pr-4">Customer</th>
              <th className="py-2 pr-4">SKU</th>
              <th className="py-2 pr-4 text-right">Qty</th>
              <th className="py-2 pr-4 text-right">Price</th>
              <th className="py-2 pr-4 text-right">Cost</th>
              <th className="py-2 pr-4 text-right">Revenue</th>
              <th className="py-2 pr-4 text-right">Margin</th>
              <th className="py-2 pr-4">Payment</th>
              <th className="py-2 pr-4"></th>
            </tr>
          </thead>
          <tbody>
            {[...sales].reverse().map((s) => (
              <tr key={s.id} className="border-b border-ink-700/60 text-ink-200">
                <td className="py-2 pr-4 chip">{s.date}</td>
                <td className="py-2 pr-4">{s.customer?.name || "—"}</td>
                <td className="py-2 pr-4">{s.sku ? `${s.sku.name} · ${s.sku.packSize}` : "—"}</td>
                <td className="py-2 pr-4 text-right chip">{s.quantity}</td>
                <td className="py-2 pr-4 text-right chip">{money(s.unitPrice)}</td>
                <td className="py-2 pr-4 text-right chip text-ink-400">{money(s.costPerUnit)}</td>
                <td className="py-2 pr-4 text-right chip">{money(s.revenue)}</td>
                <td className="py-2 pr-4 text-right chip text-moss-400">{money(s.margin)} <span className="text-ink-500">({s.marginPct.toFixed(0)}%)</span></td>
                <td className="py-2 pr-4 chip">{s.paymentMode}</td>
                <td className="py-2 pr-4 text-right"><button className="text-ink-500 hover:text-rust-400 text-xs" onClick={() => remove("sales", s.id)}>remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
