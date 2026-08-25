import { useState } from "react";
import { useApp, useMoney } from "../lib/AppContext";
import { salesWithMargin, finishedGoodsInventory } from "../lib/calc";
import Panel from "../components/Panel";
import { Field, inputCls, btnCls, btnGhostCls } from "../components/Field";

const paymentModes = ["Cash", "POS", "Transfer", "Credit"];
const blankItem = { productId: "", quantity: "", unitPrice: "" };

export default function Sales() {
  const { data, add, remove } = useApp();
  const money = useMoney();
  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [date, setDate] = useState("");
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [items, setItems] = useState([{ ...blankItem }]);

  const lines = salesWithMargin(data);
  const inv = finishedGoodsInventory(data);
  const onHandByProduct = Object.fromEntries(inv.map((r) => [r.product.id, r.qtyOnHand]));

  // Group flattened lines back into orders for a cleaner log view.
  const orderIds = [...new Set(data.salesOrders.map((o) => o.id))].reverse();
  const orderById = Object.fromEntries(data.salesOrders.map((o) => [o.id, o]));
  const customerById = Object.fromEntries(data.customers.map((c) => [c.id, c]));

  const updateItem = (i, patch) => setItems(items.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const productById = Object.fromEntries(data.products.map((p) => [p.id, p]));
  const onProductSelect = (i, productId) => {
    const product = productById[productId];
    updateItem(i, {
      productId,
      unitPrice: items[i].unitPrice || (product?.defaultPrice ? String(product.defaultPrice) : ""),
    });
  };

  const orderTotal = items.reduce((s, i) => s + (parseFloat(i.quantity) || 0) * (parseFloat(i.unitPrice) || 0), 0);

  const submit = (e) => {
    e.preventDefault();
    add("salesOrders", {
      customerId,
      date: date || new Date().toISOString().slice(0, 10),
      paymentMode,
      items: items
        .filter((i) => i.productId && i.quantity)
        .map((i) => ({ productId: i.productId, quantity: parseFloat(i.quantity) || 0, unitPrice: parseFloat(i.unitPrice) || 0 })),
    });
    setCustomerId(""); setDate(""); setPaymentMode("Cash"); setItems([{ ...blankItem }]); setOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="chip text-ink-400 uppercase">Module 04</div>
          <h1 className="font-display text-xl font-semibold text-ink-50">Sales</h1>
          <p className="text-sm text-ink-400 mt-1 max-w-lg">Record what a customer bought — one order can hold several different products.</p>
        </div>
        <button className={btnCls} onClick={() => setOpen((o) => !o)}>{open ? "Cancel" : "+ Record a sale"}</button>
      </div>

      {open && (
        <Panel title="New sale" eyebrow="One checkout, as many products as the customer is buying">
          <form onSubmit={submit} className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Field label="Customer">
                <select className={inputCls} value={customerId} onChange={(e) => setCustomerId(e.target.value)} required>
                  <option value="">Select…</option>
                  {data.customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Date"><input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
              <Field label="Payment mode">
                <select className={inputCls} value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
                  {paymentModes.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </Field>
            </div>

            <div>
              <div className="chip text-ink-400 uppercase mb-2">Items in this order</div>
              <div className="space-y-2 overflow-x-auto">
                {items.map((row, i) => (
                  <div key={i} className="grid grid-cols-9 gap-2 items-center min-w-[640px]">
                    <select className={`${inputCls} col-span-4`} value={row.productId} onChange={(e) => onProductSelect(i, e.target.value)}>
                      <option value="">Product…</option>
                      {data.products.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.packSize} — {onHandByProduct[p.id] ?? 0} on hand</option>)}
                    </select>
                    <input type="number" className={`${inputCls} col-span-2`} placeholder="qty" value={row.quantity} onChange={(e) => updateItem(i, { quantity: e.target.value })} />
                    <input type="number" step="0.01" className={`${inputCls} col-span-2`} placeholder="unit price" value={row.unitPrice} onChange={(e) => updateItem(i, { unitPrice: e.target.value })} />
                    <button type="button" className="text-ink-500 hover:text-[var(--accent)] text-xs" onClick={() => setItems(items.filter((_, idx) => idx !== i))}>remove</button>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between mt-2">
                <button type="button" className={btnGhostCls} onClick={() => setItems([...items, { ...blankItem }])}>+ add item</button>
                <span className="chip text-ink-300">Order total: <span className="text-[var(--accent)]">{money(orderTotal)}</span></span>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button type="button" className={btnGhostCls} onClick={() => setOpen(false)}>Cancel</button>
              <button type="submit" className={btnCls}>Save order</button>
            </div>
          </form>
        </Panel>
      )}

      <Panel title="Orders" eyebrow="Cost per line uses each product's current weighted-average from production">
        <div className="space-y-3">
          {orderIds.map((orderId) => {
            const order = orderById[orderId];
            const orderLines = lines.filter((l) => l.orderId === orderId);
            const total = orderLines.reduce((s, l) => s + l.revenue, 0);
            const margin = orderLines.reduce((s, l) => s + l.margin, 0);
            return (
              <div key={orderId} className="border border-ink-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <span className="chip text-ink-500">{order.date}</span>
                    <span className="text-sm text-ink-100">{customerById[order.customerId]?.name || "—"}</span>
                    <span className="chip text-ink-500">{order.paymentMode}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="chip text-ink-300">revenue {money(total)}</span>
                    <span className="chip text-moss-400">margin {money(margin)}</span>
                    <button className="text-ink-500 hover:text-[var(--accent)] text-xs" onClick={() => remove("salesOrders", orderId)}>remove order</button>
                  </div>
                </div>
                <div className="overflow-x-auto">
<table className="w-full text-sm" style={{minWidth: "600px"}}>
                  <thead>
                    <tr className="text-left chip text-ink-500 uppercase border-b border-ink-700">
                      <th className="py-1.5 pr-4">Product</th>
                      <th className="py-1.5 pr-4 text-right">Qty</th>
                      <th className="py-1.5 pr-4 text-right">Price</th>
                      <th className="py-1.5 pr-4 text-right">Cost</th>
                      <th className="py-1.5 pr-4 text-right">Margin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderLines.map((l) => (
                      <tr key={l.id} className="text-ink-200">
                        <td className="py-1.5 pr-4">{l.product ? `${l.product.name} · ${l.product.packSize}` : "—"}</td>
                        <td className="py-1.5 pr-4 text-right chip">{l.quantity}</td>
                        <td className="py-1.5 pr-4 text-right chip">{money(l.unitPrice)}</td>
                        <td className="py-1.5 pr-4 text-right chip text-ink-400">{money(l.costPerUnit)}</td>
                        <td className="py-1.5 pr-4 text-right chip text-moss-400">{money(l.margin)} <span className="text-ink-500">({l.marginPct.toFixed(0)}%)</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
</div>
              </div>
            );
          })}
          {orderIds.length === 0 && <p className="text-ink-500 text-center py-6">No orders yet.</p>}
        </div>
      </Panel>
    </div>
  );
}
