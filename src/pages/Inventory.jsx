import { useState } from "react";
import { useApp, useMoney } from "../lib/AppContext";
import { finishedGoodsInventory, materialLedger, estimateSpoilageValue } from "../lib/calc";
import { allUnits, formatQuantity } from "../lib/uom";
import Panel from "../components/Panel";
import { Field, inputCls, btnCls, btnGhostCls } from "../components/Field";

const blankSpoil = { kind: "product", productId: "", itemName: "", quantity: "", unit: "kg", date: "", reason: "" };

export default function Inventory() {
  const { data, add, remove } = useApp();
  const money = useMoney();
  const [openSpoil, setOpenSpoil] = useState(false);
  const [spoilForm, setSpoilForm] = useState(blankSpoil);

  const inv = finishedGoodsInventory(data);
  const ledger = materialLedger(data);
  const finishedValue = inv.reduce((s, r) => s + r.valueOnHand, 0);
  const rawValue = ledger.reduce((s, r) => s + r.valueRemaining, 0);
  const spoilagePreview = spoilForm.quantity ? estimateSpoilageValue(data, spoilForm) : null;

  const submitSpoil = (e) => {
    e.preventDefault();
    const { value } = estimateSpoilageValue(data, spoilForm);
    const record = spoilForm.kind === "product"
      ? { kind: "product", productId: spoilForm.productId, quantity: parseFloat(spoilForm.quantity) || 0, date: spoilForm.date || new Date().toISOString().slice(0, 10), reason: spoilForm.reason, valueLost: value }
      : { kind: "material", itemName: spoilForm.itemName, unit: spoilForm.unit, quantity: parseFloat(spoilForm.quantity) || 0, date: spoilForm.date || new Date().toISOString().slice(0, 10), reason: spoilForm.reason, valueLost: value };
    add("spoilage", record);
    setSpoilForm(blankSpoil);
    setOpenSpoil(false);
  };

  const totalSpoilageValue = (data.spoilage || []).reduce((s, sp) => s + (sp.valueLost || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="chip text-ink-400 uppercase">Module 03</div>
          <h1 className="font-display text-xl font-semibold text-ink-50">Inventory</h1>
          <p className="text-sm text-ink-400 mt-1 max-w-lg">What's actually on the shelf right now — finished goods and raw materials, valued automatically.</p>
        </div>
        <button className={btnGhostCls} onClick={() => setOpenSpoil((o) => !o)}>{openSpoil ? "Cancel" : "+ Log spoilage"}</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-ink-800 border border-ink-700 rounded-lg px-5 py-4">
          <div className="chip text-ink-400 uppercase">Finished goods value</div>
          <div className="font-display text-2xl font-semibold text-brass-400 mt-1.5">{money(finishedValue)}</div>
        </div>
        <div className="bg-ink-800 border border-ink-700 rounded-lg px-5 py-4">
          <div className="chip text-ink-400 uppercase">Raw material value</div>
          <div className="font-display text-2xl font-semibold text-brass-400 mt-1.5">{money(rawValue)}</div>
        </div>
        <div className="bg-ink-800 border border-ink-700 rounded-lg px-5 py-4">
          <div className="chip text-ink-400 uppercase">Value lost to spoilage</div>
          <div className="font-display text-2xl font-semibold text-[var(--accent)] mt-1.5">{money(totalSpoilageValue)}</div>
        </div>
      </div>

      {openSpoil && (
        <Panel title="Log spoilage / write-off" eyebrow="Removes from inventory without a sale — value lost is estimated automatically">
          <form onSubmit={submitSpoil} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <Field label="What spoiled">
              <select className={inputCls} value={spoilForm.kind} onChange={(e) => setSpoilForm({ ...blankSpoil, kind: e.target.value })}>
                <option value="product">A finished product</option>
                <option value="material">A raw material</option>
              </select>
            </Field>
            {spoilForm.kind === "product" ? (
              <Field label="Product">
                <select className={inputCls} value={spoilForm.productId} onChange={(e) => setSpoilForm({ ...spoilForm, productId: e.target.value })} required>
                  <option value="">Select…</option>
                  {data.products.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.packSize}</option>)}
                </select>
              </Field>
            ) : (
              <>
                <Field label="Material">
                  <select className={inputCls} value={spoilForm.itemName} onChange={(e) => setSpoilForm({ ...spoilForm, itemName: e.target.value })} required>
                    <option value="">Select…</option>
                    {ledger.map((m) => <option key={m.itemName} value={m.itemName}>{m.itemName} ({formatQuantity(m.remainingBase, m.baseUnit)} left)</option>)}
                  </select>
                </Field>
                <Field label="Unit">
                  <select className={inputCls} value={spoilForm.unit} onChange={(e) => setSpoilForm({ ...spoilForm, unit: e.target.value })}>
                    {allUnits(data.customUnits).map((u) => <option key={u.unit} value={u.unit}>{u.unit}</option>)}
                  </select>
                </Field>
              </>
            )}
            <Field label="Units spoilt"><input type="number" step="0.01" className={inputCls} value={spoilForm.quantity} onChange={(e) => setSpoilForm({ ...spoilForm, quantity: e.target.value })} required /></Field>
            <Field label="Date"><input type="date" className={inputCls} value={spoilForm.date} onChange={(e) => setSpoilForm({ ...spoilForm, date: e.target.value })} /></Field>
            <Field label="Notes — how it spoiled">
              <input className={inputCls} value={spoilForm.reason} onChange={(e) => setSpoilForm({ ...spoilForm, reason: e.target.value })} placeholder="e.g. left out overnight, packaging burst" />
            </Field>
            <div className="col-span-1 sm:col-span-2 md:col-span-4 flex items-center justify-between gap-2 pt-1">
              <span className="chip text-ink-400">
                {spoilagePreview ? `Estimated value lost: ${money(spoilagePreview.value)} (${spoilagePreview.basis})` : "Enter a quantity to see the estimated value lost"}
              </span>
              <button type="submit" className={btnCls}>Save</button>
            </div>
          </form>
        </Panel>
      )}

      <Panel title="Finished goods" eyebrow="What production has made, minus sold and spoiled — add or edit products in the Products module">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: "600px" }}>
            <thead>
              <tr className="text-left chip text-ink-500 uppercase border-b border-ink-700">
                <th className="py-2 pr-4">Product</th>
                <th className="py-2 pr-4 text-right">Produced</th>
                <th className="py-2 pr-4 text-right">Sold</th>
                <th className="py-2 pr-4 text-right">Spoiled</th>
                <th className="py-2 pr-4 text-right">On hand</th>
                <th className="py-2 pr-4 text-right">Avg cost / unit</th>
                <th className="py-2 pr-4 text-right">Value on hand</th>
              </tr>
            </thead>
            <tbody>
              {inv.map((r) => (
                <tr key={r.product.id} className="border-b border-ink-700/60 text-ink-200">
                  <td className="py-2 pr-4">
                    <div className="flex items-center gap-2">
                      {r.product.imageDataUrl && <img src={r.product.imageDataUrl} alt="" className="w-8 h-8 rounded object-cover border border-ink-700" />}
                      <span>{r.product.name} · {r.product.flavor} · {r.product.packSize}</span>
                    </div>
                  </td>
                  <td className="py-2 pr-4 text-right chip">{r.producedQty}</td>
                  <td className="py-2 pr-4 text-right chip">{r.soldQty}</td>
                  <td className="py-2 pr-4 text-right chip">{r.spoiledQty}</td>
                  <td className="py-2 pr-4 text-right chip text-brass-400">{r.qtyOnHand}</td>
                  <td className="py-2 pr-4 text-right chip">{money(r.avgCostPerUnit)}</td>
                  <td className="py-2 pr-4 text-right chip">{money(r.valueOnHand)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Raw materials" eyebrow="What's left in the store room">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: "600px" }}>
            <thead>
              <tr className="text-left chip text-ink-500 uppercase border-b border-ink-700">
                <th className="py-2 pr-4">Material</th>
                <th className="py-2 pr-4 text-right">Spoiled</th>
                <th className="py-2 pr-4 text-right">Remaining</th>
                <th className="py-2 pr-4 text-right">Value</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((r) => (
                <tr key={r.itemName} className="border-b border-ink-700/60 text-ink-200">
                  <td className="py-2 pr-4">{r.itemName}</td>
                  <td className="py-2 pr-4 text-right chip">{r.spoiledBase > 0 ? formatQuantity(r.spoiledBase, r.baseUnit) : "—"}</td>
                  <td className="py-2 pr-4 text-right chip">{formatQuantity(r.remainingBase, r.baseUnit)}</td>
                  <td className="py-2 pr-4 text-right chip">{money(r.valueRemaining)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Spoilage log" eyebrow="Every write-off, with its estimated cost">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: "600px" }}>
            <thead>
              <tr className="text-left chip text-ink-500 uppercase border-b border-ink-700">
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Item</th>
                <th className="py-2 pr-4 text-right">Qty</th>
                <th className="py-2 pr-4">Notes</th>
                <th className="py-2 pr-4 text-right">Value lost</th>
                <th className="py-2 pr-4"></th>
              </tr>
            </thead>
            <tbody>
              {[...(data.spoilage || [])].reverse().map((s) => {
                const product = s.kind === "product" ? data.products.find((p) => p.id === s.productId) : null;
                return (
                  <tr key={s.id} className="border-b border-ink-700/60 text-ink-200">
                    <td className="py-2 pr-4 chip">{s.date}</td>
                    <td className="py-2 pr-4">{s.kind === "product" ? (product ? `${product.name} · ${product.packSize}` : "—") : s.itemName}</td>
                    <td className="py-2 pr-4 text-right chip">{s.quantity} {s.kind === "material" ? s.unit : "unit"}</td>
                    <td className="py-2 pr-4 text-ink-400 text-xs">{s.reason || "—"}</td>
                    <td className="py-2 pr-4 text-right chip text-[var(--accent)]">{money(s.valueLost || 0)}</td>
                    <td className="py-2 pr-4 text-right"><button className="text-ink-500 hover:text-[var(--accent)] text-xs" onClick={() => { if (confirm("Remove this spoilage entry? This can't be undone.")) remove("spoilage", s.id); }}>remove</button></td>
                  </tr>
                );
              })}
              {(data.spoilage || []).length === 0 && <tr><td colSpan={6} className="py-6 text-center text-ink-500">No spoilage logged.</td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
