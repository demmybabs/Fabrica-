import { useState } from "react";
import { useApp } from "../lib/AppContext";
import Panel from "../components/Panel";
import { Field, inputCls, btnCls, btnGhostCls } from "../components/Field";

const blank = { name: "", contact: "" };

export default function Suppliers() {
  const { data, add, remove } = useApp();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blank);

  const batchCountBySupplier = {};
  for (const b of data.supplyBatches) {
    batchCountBySupplier[b.supplierId] = (batchCountBySupplier[b.supplierId] || 0) + 1;
  }

  const submit = (e) => {
    e.preventDefault();
    add("suppliers", form);
    setForm(blank);
    setOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="chip text-ink-400 uppercase">Module 01a</div>
          <h1 className="font-display text-xl font-semibold text-ink-50">Suppliers</h1>
        </div>
        <button className={btnCls} onClick={() => setOpen((o) => !o)}>{open ? "Cancel" : "+ Onboard a supplier"}</button>
      </div>

      {open && (
        <Panel title="New supplier" eyebrow="Once saved, they're selectable from every delivery form">
          <form onSubmit={submit} className="grid grid-cols-2 gap-4">
            <Field label="Supplier name"><input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
            <Field label="Contact (email / phone)"><input className={inputCls} value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} /></Field>
            <div className="col-span-2 flex justify-end gap-2">
              <button type="button" className={btnGhostCls} onClick={() => setOpen(false)}>Cancel</button>
              <button type="submit" className={btnCls}>Save supplier</button>
            </div>
          </form>
        </Panel>
      )}

      <Panel title="Supplier directory" eyebrow="Everyone you buy raw materials from">
        <table className="w-full text-sm">
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
                <td className="py-2 pr-4 text-right">
                  <button className="text-ink-500 hover:text-[var(--accent)] text-xs" onClick={() => remove("suppliers", s.id)}>remove</button>
                </td>
              </tr>
            ))}
            {data.suppliers.length === 0 && (
              <tr><td colSpan={4} className="py-6 text-center text-ink-500">No suppliers yet — onboard your first one above.</td></tr>
            )}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
