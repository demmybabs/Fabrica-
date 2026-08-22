import { useState } from "react";
import { useApp } from "../lib/AppContext";
import { customerAnalytics } from "../lib/calc";
import Panel from "../components/Panel";
import StatCard from "../components/StatCard";
import { Field, inputCls, btnCls, btnGhostCls } from "../components/Field";

function money(n) {
  return `$${(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const blank = { name: "", gender: "", profession: "", segment: "Retail" };

export default function Customers() {
  const { data, add, remove } = useApp();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blank);

  const analytics = customerAnalytics(data).sort((a, b) => b.revenue - a.revenue);
  const byGender = {};
  const byProfession = {};
  for (const row of analytics) {
    const g = row.customer.gender || "Unspecified";
    byGender[g] = (byGender[g] || 0) + row.revenue;
    const p = row.customer.profession || "Unspecified";
    byProfession[p] = (byProfession[p] || 0) + row.revenue;
  }
  const topGender = Object.entries(byGender).sort((a, b) => b[1] - a[1])[0];
  const topProfession = Object.entries(byProfession).sort((a, b) => b[1] - a[1])[0];
  const best = analytics[0];

  const submit = (e) => {
    e.preventDefault();
    add("customers", { ...form, createdAt: new Date().toISOString().slice(0, 10) });
    setForm(blank); setOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="chip text-ink-400 uppercase">Module 05</div>
          <h1 className="font-display text-xl font-semibold text-ink-50">Customers</h1>
        </div>
        <button className={btnCls} onClick={() => setOpen((o) => !o)}>{open ? "Cancel" : "+ Onboard a customer"}</button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Best customer" value={best?.customer.name || "—"} sub={best ? money(best.revenue) + " lifetime" : ""} tone="moss" />
        <StatCard label="Top-spending gender" value={topGender ? topGender[0] : "—"} sub={topGender ? money(topGender[1]) : ""} />
        <StatCard label="Top-spending profession" value={topProfession ? topProfession[0] : "—"} sub={topProfession ? money(topProfession[1]) : ""} />
      </div>

      {open && (
        <Panel title="New customer" eyebrow="Personalize their profile for analytics">
          <form onSubmit={submit} className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Field label="Name"><input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
            <Field label="Gender"><input className={inputCls} value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} /></Field>
            <Field label="Profession"><input className={inputCls} value={form.profession} onChange={(e) => setForm({ ...form, profession: e.target.value })} /></Field>
            <Field label="Segment">
              <select className={inputCls} value={form.segment} onChange={(e) => setForm({ ...form, segment: e.target.value })}>
                <option>Retail</option><option>Wholesale</option>
              </select>
            </Field>
            <div className="col-span-2 md:col-span-4 flex justify-end gap-2">
              <button type="button" className={btnGhostCls} onClick={() => setOpen(false)}>Cancel</button>
              <button type="submit" className={btnCls}>Save customer</button>
            </div>
          </form>
        </Panel>
      )}

      <Panel title="Customer performance" eyebrow="Ranked by lifetime revenue">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left chip text-ink-500 uppercase border-b border-ink-700">
              <th className="py-2 pr-4">Customer</th>
              <th className="py-2 pr-4">Segment</th>
              <th className="py-2 pr-4">Profession</th>
              <th className="py-2 pr-4 text-right">Orders</th>
              <th className="py-2 pr-4 text-right">Revenue</th>
              <th className="py-2 pr-4 text-right">Margin</th>
              <th className="py-2 pr-4">Last purchase</th>
              <th className="py-2 pr-4"></th>
            </tr>
          </thead>
          <tbody>
            {analytics.map((row) => (
              <tr key={row.customer.id} className="border-b border-ink-700/60 text-ink-200">
                <td className="py-2 pr-4">{row.customer.name}</td>
                <td className="py-2 pr-4 chip">{row.customer.segment}</td>
                <td className="py-2 pr-4">{row.customer.profession || "—"}</td>
                <td className="py-2 pr-4 text-right chip">{row.orders}</td>
                <td className="py-2 pr-4 text-right chip">{money(row.revenue)}</td>
                <td className="py-2 pr-4 text-right chip text-moss-400">{money(row.margin)}</td>
                <td className="py-2 pr-4 chip">{row.lastDate || "—"}</td>
                <td className="py-2 pr-4 text-right"><button className="text-ink-500 hover:text-rust-400 text-xs" onClick={() => remove("customers", row.customer.id)}>remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
