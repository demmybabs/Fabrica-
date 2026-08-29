import { useState, Fragment } from "react";
import { useApp, useMoney } from "../lib/AppContext";
import { customerAnalytics, performanceByAttribute } from "../lib/calc";
import Panel from "../components/Panel";
import StatCard from "../components/StatCard";
import { Field, inputCls, btnCls, btnGhostCls } from "../components/Field";

const blank = { name: "", gender: "", profession: "", segment: "", subCategory: "", state: "", city: "", email: "", phone: "" };

export default function Customers() {
  const { data, add, update, remove, addSegment, addWholesaleSubCategory } = useApp();
  const money = useMoney();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...blank, segment: data.segments[0] || "" });
  const [addingSegment, setAddingSegment] = useState(false);
  const [newSegment, setNewSegment] = useState("");
  const [addingSubCategory, setAddingSubCategory] = useState(false);
  const [newSubCategory, setNewSubCategory] = useState("");
  const [customPrices, setCustomPrices] = useState({});
  const [editingPricesFor, setEditingPricesFor] = useState(null);

  const analytics = customerAnalytics(data).sort((a, b) => b.revenue - a.revenue);
  const bySegment = performanceByAttribute(data, "segment");
  const byGender = performanceByAttribute(data, "gender");
  const byProfession = performanceByAttribute(data, "profession");
  const best = analytics[0];
  const isWholesale = form.segment === "Wholesale";
  const totalReceivables = analytics.reduce((s, r) => s + r.balance, 0);

  const submit = (e) => {
    e.preventDefault();
    const pricesBySegmentOverride = {};
    if (isWholesale) {
      for (const p of data.products) {
        if (customPrices[p.id]) pricesBySegmentOverride[p.id] = parseFloat(customPrices[p.id]) || 0;
      }
    }
    if (isWholesale && form.subCategory) {
      const trimmed = form.subCategory.trim();
      if (trimmed && !data.wholesaleSubCategories.includes(trimmed)) addWholesaleSubCategory(trimmed);
    }
    add("customers", {
      ...form,
      gender: isWholesale ? "" : form.gender,
      profession: isWholesale ? "" : form.profession,
      customPrices: pricesBySegmentOverride,
      createdAt: new Date().toISOString().slice(0, 10),
    });
    setForm({ ...blank, segment: data.segments[0] || "" });
    setCustomPrices({});
    setOpen(false);
  };

  const saveNewSegment = () => {
    const name = newSegment.trim();
    if (!name) return;
    addSegment(name);
    setForm({ ...form, segment: name });
    setNewSegment("");
    setAddingSegment(false);
  };

  const saveNewSubCategory = () => {
    const name = newSubCategory.trim();
    if (!name) return;
    addWholesaleSubCategory(name);
    setForm({ ...form, subCategory: name });
    setNewSubCategory("");
    setAddingSubCategory(false);
  };

  const updateExistingCustomerPrice = (customer, productId, value) => {
    update("customers", customer.id, { customPrices: { ...customer.customPrices, [productId]: parseFloat(value) || 0 } });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="chip text-ink-400 uppercase">Module 05</div>
          <h1 className="font-display text-xl font-semibold text-ink-50">Customers</h1>
          <p className="text-sm text-ink-400 mt-1 max-w-lg">Everyone who buys from you, with performance and spending patterns per customer.</p>
        </div>
        <button className={btnCls} onClick={() => setOpen((o) => !o)}>{open ? "Cancel" : "+ Onboard a customer"}</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard label="Best customer" value={best?.customer.name || "—"} sub={best ? money(best.revenue) + " lifetime" : ""} tone="moss" />
        <StatCard label="Top segment" value={bySegment[0]?.key || "—"} sub={bySegment[0] ? money(bySegment[0].revenue) : ""} />
        <StatCard label="Top profession" value={byProfession[0]?.key || "—"} sub={byProfession[0] ? money(byProfession[0].revenue) : ""} />
        <StatCard label="Outstanding receivables" value={money(totalReceivables)} tone="rust" sub="owed by customers" />
      </div>

      {open && (
        <Panel title="New customer" eyebrow="Personalize their profile for analytics">
          <form onSubmit={submit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <Field label="Name"><input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
              <Field label="Segment">
                {addingSegment ? (
                  <div className="flex gap-2">
                    <input className={inputCls} value={newSegment} onChange={(e) => setNewSegment(e.target.value)} placeholder="New segment name" autoFocus />
                    <button type="button" className="chip text-[var(--accent)] shrink-0" onClick={saveNewSegment}>save</button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <select className={inputCls} value={form.segment} onChange={(e) => setForm({ ...form, segment: e.target.value })}>
                      {data.segments.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <button type="button" className="chip text-[var(--accent)] shrink-0" onClick={() => setAddingSegment(true)}>+ new</button>
                  </div>
                )}
              </Field>
              {isWholesale ? (
                <Field label="Wholesale category">
                  {addingSubCategory ? (
                    <div className="flex gap-2">
                      <input className={inputCls} value={newSubCategory} onChange={(e) => setNewSubCategory(e.target.value)} placeholder="New category name" autoFocus />
                      <button type="button" className="chip text-[var(--accent)] shrink-0" onClick={saveNewSubCategory}>save</button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <select className={inputCls} value={form.subCategory} onChange={(e) => setForm({ ...form, subCategory: e.target.value })}>
                        <option value="">Select…</option>
                        {data.wholesaleSubCategories.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <button type="button" className="chip text-[var(--accent)] shrink-0" onClick={() => setAddingSubCategory(true)}>+ new</button>
                    </div>
                  )}
                </Field>
              ) : (
                <>
                  <Field label="Gender"><input className={inputCls} value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} /></Field>
                  <Field label="Profession"><input className={inputCls} value={form.profession} onChange={(e) => setForm({ ...form, profession: e.target.value })} /></Field>
                </>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <Field label="State"><input className={inputCls} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} /></Field>
              <Field label="City"><input className={inputCls} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
              <Field label="Email"><input type="email" className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
              <Field label="Phone"><input className={inputCls} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            </div>

            {isWholesale && (
              <div>
                <div className="chip text-ink-400 uppercase mb-2">Selling price for this customer, per product</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {data.products.map((p) => (
                    <Field key={p.id} label={`${p.name} · ${p.packSize}`}>
                      <input
                        type="number" step="0.01" className={inputCls}
                        value={customPrices[p.id] || ""}
                        onChange={(e) => setCustomPrices({ ...customPrices, [p.id]: e.target.value })}
                        placeholder={p.pricesBySegment?.Wholesale ? String(p.pricesBySegment.Wholesale) : "0.00"}
                      />
                    </Field>
                  ))}
                  {data.products.length === 0 && <p className="text-ink-500 text-sm">No products yet — add some in the Products module first.</p>}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button type="button" className={btnGhostCls} onClick={() => setOpen(false)}>Cancel</button>
              <button type="submit" className={btnCls}>Save customer</button>
            </div>
          </form>
        </Panel>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Panel title="By segment" eyebrow="Revenue and margin">
          <BreakdownTable rows={bySegment} money={money} />
        </Panel>
        <Panel title="By gender" eyebrow="Revenue and margin">
          <BreakdownTable rows={byGender} money={money} />
        </Panel>
        <Panel title="By profession" eyebrow="Revenue and margin">
          <BreakdownTable rows={byProfession} money={money} />
        </Panel>
      </div>

      <Panel title="Customer performance" eyebrow="Ranked by lifetime revenue — click a wholesale customer to edit their per-product pricing">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: "700px" }}>
            <thead>
              <tr className="text-left chip text-ink-500 uppercase border-b border-ink-700">
                <th className="py-2 pr-4">Customer</th>
                <th className="py-2 pr-4">Segment</th>
                <th className="py-2 pr-4">Contact</th>
                <th className="py-2 pr-4 text-right">Orders</th>
                <th className="py-2 pr-4 text-right">Revenue</th>
                <th className="py-2 pr-4 text-right">Margin</th>
                <th className="py-2 pr-4 text-right">Balance owed</th>
                <th className="py-2 pr-4"></th>
              </tr>
            </thead>
            <tbody>
              {analytics.map((row) => (
                <Fragment key={row.customer.id}>
                  <tr className="border-b border-ink-700/60 text-ink-200">
                    <td className="py-2 pr-4">{row.customer.name}</td>
                    <td className="py-2 pr-4 chip">{row.customer.segment}{row.customer.subCategory ? ` · ${row.customer.subCategory}` : ""}</td>
                    <td className="py-2 pr-4 text-ink-400 text-xs">{row.customer.phone || row.customer.email || "—"}</td>
                    <td className="py-2 pr-4 text-right chip">{row.orders}</td>
                    <td className="py-2 pr-4 text-right chip">{money(row.revenue)}</td>
                    <td className="py-2 pr-4 text-right chip text-moss-400">{money(row.margin)}</td>
                    <td className="py-2 pr-4 text-right chip text-[var(--accent)]">{row.balance > 0 ? money(row.balance) : "—"}</td>
                    <td className="py-2 pr-4 text-right whitespace-nowrap">
                      {row.customer.segment === "Wholesale" && (
                        <button className="text-ink-500 hover:text-[var(--accent)] text-xs mr-3" onClick={() => setEditingPricesFor(editingPricesFor === row.customer.id ? null : row.customer.id)}>
                          {editingPricesFor === row.customer.id ? "close" : "prices"}
                        </button>
                      )}
                      <button className="text-ink-500 hover:text-[var(--accent)] text-xs" onClick={() => remove("customers", row.customer.id)}>remove</button>
                    </td>
                  </tr>
                  {editingPricesFor === row.customer.id && (
                    <tr className="bg-ink-900/50">
                      <td colSpan={8} className="p-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                          {data.products.map((p) => (
                            <Field key={p.id} label={`${p.name} · ${p.packSize}`}>
                              <input
                                type="number" step="0.01" className={inputCls}
                                value={row.customer.customPrices?.[p.id] ?? ""}
                                onChange={(e) => updateExistingCustomerPrice(row.customer, p.id, e.target.value)}
                                placeholder={p.pricesBySegment?.Wholesale ? String(p.pricesBySegment.Wholesale) : "0.00"}
                              />
                            </Field>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function BreakdownTable({ rows, money }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left chip text-ink-500 uppercase border-b border-ink-700">
          <th className="py-1.5 pr-3">Group</th>
          <th className="py-1.5 pr-3 text-right">Revenue</th>
          <th className="py-1.5 pr-3 text-right">Margin</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key} className="text-ink-200 border-b border-ink-700/60">
            <td className="py-1.5 pr-3">{r.key}</td>
            <td className="py-1.5 pr-3 text-right chip">{money(r.revenue)}</td>
            <td className="py-1.5 pr-3 text-right chip text-moss-400">{money(r.margin)}</td>
          </tr>
        ))}
        {rows.length === 0 && <tr><td colSpan={3} className="py-4 text-center text-ink-500">No sales yet.</td></tr>}
      </tbody>
    </table>
  );
}
