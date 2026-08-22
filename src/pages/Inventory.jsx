import { useState } from "react";
import { useApp } from "../lib/AppContext";
import { finishedGoodsInventory, materialLedger } from "../lib/calc";
import Panel from "../components/Panel";
import { Field, inputCls, btnCls, btnGhostCls } from "../components/Field";

function money(n) {
  return `$${(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const blankSku = { name: "", flavor: "", packSize: "" };
const blankSpoil = { skuId: "", quantity: "", date: "", reason: "" };

export default function Inventory() {
  const { data, add, remove } = useApp();
  const [openSku, setOpenSku] = useState(false);
  const [openSpoil, setOpenSpoil] = useState(false);
  const [skuForm, setSkuForm] = useState(blankSku);
  const [spoilForm, setSpoilForm] = useState(blankSpoil);

  const inv = finishedGoodsInventory(data);
  const ledger = materialLedger(data);
  const finishedValue = inv.reduce((s, r) => s + r.valueOnHand, 0);
  const rawValue = ledger.reduce((s, r) => s + r.valueRemaining, 0);

  const submitSku = (e) => {
    e.preventDefault();
    add("skus", { ...skuForm, unit: "unit" });
    setSkuForm(blankSku); setOpenSku(false);
  };
  const submitSpoil = (e) => {
    e.preventDefault();
    add("spoilage", { ...spoilForm, quantity: parseFloat(spoilForm.quantity) || 0, date: spoilForm.date || new Date().toISOString().slice(0, 10) });
    setSpoilForm(blankSpoil); setOpenSpoil(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="chip text-ink-400 uppercase">Module 03</div>
          <h1 className="font-display text-xl font-semibold text-ink-50">Inventory</h1>
        </div>
        <div className="flex gap-2">
          <button className={btnGhostCls} onClick={() => setOpenSpoil((o) => !o)}>{openSpoil ? "Cancel" : "+ Log spoilage"}</button>
          <button className={btnCls} onClick={() => setOpenSku((o) => !o)}>{openSku ? "Cancel" : "+ New SKU"}</button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-ink-800 border border-ink-700 rounded-lg px-5 py-4">
          <div className="chip text-ink-400 uppercase">Finished goods value</div>
          <div className="font-display text-2xl font-semibold text-brass-400 mt-1.5">{money(finishedValue)}</div>
        </div>
        <div className="bg-ink-800 border border-ink-700 rounded-lg px-5 py-4">
          <div className="chip text-ink-400 uppercase">Raw material value</div>
          <div className="font-display text-2xl font-semibold text-brass-400 mt-1.5">{money(rawValue)}</div>
        </div>
      </div>

      {openSku && (
        <Panel title="New SKU" eyebrow="A sellable finished-goods item">
          <form onSubmit={submitSku} className="grid grid-cols-3 gap-4">
            <Field label="Product name"><input className={inputCls} value={skuForm.name} onChange={(e) => setSkuForm({ ...skuForm, name: e.target.value })} required /></Field>
            <Field label="Flavor / variant"><input className={inputCls} value={skuForm.flavor} onChange={(e) => setSkuForm({ ...skuForm, flavor: e.target.value })} /></Field>
            <Field label="Pack size"><input className={inputCls} value={skuForm.packSize} onChange={(e) => setSkuForm({ ...skuForm, packSize: e.target.value })} placeholder="e.g. 500g" required /></Field>
            <div className="col-span-3 flex justify-end gap-2"><button type="submit" className={btnCls}>Save SKU</button></div>
          </form>
        </Panel>
      )}

      {openSpoil && (
        <Panel title="Log spoilage / write-off" eyebrow="Removes from inventory without a sale">
          <form onSubmit={submitSpoil} className="grid grid-cols-4 gap-4">
            <Field label="SKU">
              <select className={inputCls} value={spoilForm.skuId} onChange={(e) => setSpoilForm({ ...spoilForm, skuId: e.target.value })} required>
                <option value="">Select…</option>
                {data.skus.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.packSize}</option>)}
              </select>
            </Field>
            <Field label="Quantity"><input type="number" className={inputCls} value={spoilForm.quantity} onChange={(e) => setSpoilForm({ ...spoilForm, quantity: e.target.value })} required /></Field>
            <Field label="Date"><input type="date" className={inputCls} value={spoilForm.date} onChange={(e) => setSpoilForm({ ...spoilForm, date: e.target.value })} /></Field>
            <Field label="Reason"><input className={inputCls} value={spoilForm.reason} onChange={(e) => setSpoilForm({ ...spoilForm, reason: e.target.value })} /></Field>
            <div className="col-span-4 flex justify-end gap-2"><button type="submit" className={btnCls}>Save</button></div>
          </form>
        </Panel>
      )}

      <Panel title="Finished goods" eyebrow="What production has made, minus sold and spoiled">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left chip text-ink-500 uppercase border-b border-ink-700">
              <th className="py-2 pr-4">SKU</th>
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
              <tr key={r.sku.id} className="border-b border-ink-700/60 text-ink-200">
                <td className="py-2 pr-4">{r.sku.name} · {r.sku.flavor} · {r.sku.packSize}</td>
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
      </Panel>

      <Panel title="Raw materials" eyebrow="What's left in the store room">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left chip text-ink-500 uppercase border-b border-ink-700">
              <th className="py-2 pr-4">Material</th>
              <th className="py-2 pr-4 text-right">Remaining</th>
              <th className="py-2 pr-4 text-right">Value</th>
            </tr>
          </thead>
          <tbody>
            {ledger.map((r) => (
              <tr key={r.itemName} className="border-b border-ink-700/60 text-ink-200">
                <td className="py-2 pr-4">{r.itemName}</td>
                <td className="py-2 pr-4 text-right chip">{r.remainingBase.toFixed(1)} {r.baseUnit}</td>
                <td className="py-2 pr-4 text-right chip">{money(r.valueRemaining)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
