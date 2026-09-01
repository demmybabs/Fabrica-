import { useState } from "react";
import { useApp, useMoney } from "../lib/AppContext";
import { useConfirm } from "../lib/ConfirmContext";
import { salesWithMargin, finishedGoodsInventory, orderPayments, orderPaidTotal } from "../lib/calc";
import Panel from "../components/Panel";
import { Field, inputCls, btnCls, btnGhostCls } from "../components/Field";

const paymentModes = ["Cash", "POS", "Transfer", "Credit"];
const blankItem = { productId: "", quantity: "", unitPrice: "" };
const blankPayment = { amount: "", mode: "Cash" };

export default function Sales() {
  const { data, add, update, remove } = useApp();
  const money = useMoney();
  const confirmAction = useConfirm();
  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [date, setDate] = useState("");
  const [items, setItems] = useState([{ ...blankItem }]);
  const [payments, setPayments] = useState([{ ...blankPayment }]);
  const [formError, setFormError] = useState("");
  const [paymentDrafts, setPaymentDrafts] = useState({});

  const lines = salesWithMargin(data);
  const inv = finishedGoodsInventory(data);
  const onHandByProduct = Object.fromEntries(inv.map((r) => [r.product.id, r.qtyOnHand]));

  // Group flattened lines back into orders for a cleaner log view.
  const orderIds = [...new Set(data.salesOrders.map((o) => o.id))].reverse();
  const orderById = Object.fromEntries(data.salesOrders.map((o) => [o.id, o]));
  const customerById = Object.fromEntries(data.customers.map((c) => [c.id, c]));
  const productById = Object.fromEntries(data.products.map((p) => [p.id, p]));

  const updateItem = (i, patch) => setItems(items.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const onProductSelect = (i, productId) => {
    const product = productById[productId];
    const customer = customerById[customerId];
    const customPrice = customer?.segment === "Wholesale" ? customer.customPrices?.[productId] : undefined;
    const segmentPrice = customer ? product?.pricesBySegment?.[customer.segment] : undefined;
    const fallbackPrice = product?.pricesBySegment ? Object.values(product.pricesBySegment)[0] : undefined;
    const suggested = customPrice ?? segmentPrice ?? fallbackPrice;
    updateItem(i, {
      productId,
      unitPrice: items[i].unitPrice || (suggested !== undefined ? String(suggested) : ""),
    });
  };

  const orderTotal = items.reduce((s, i) => s + (parseFloat(i.quantity) || 0) * (parseFloat(i.unitPrice) || 0), 0);
  const totalEnteredPayments = payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
  const balance = orderTotal - totalEnteredPayments;
  const updatePayment = (i, patch) => setPayments(payments.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const checkStockAvailability = () => {
    // Sum requested quantity per product, in case the same product is
    // added on more than one line, then compare against what's actually
    // on the shelf right now.
    const requestedByProduct = {};
    for (const item of items) {
      if (!item.productId || !item.quantity) continue;
      requestedByProduct[item.productId] = (requestedByProduct[item.productId] || 0) + (parseFloat(item.quantity) || 0);
    }
    const violations = [];
    for (const [productId, requested] of Object.entries(requestedByProduct)) {
      const onHand = onHandByProduct[productId] || 0;
      if (requested > onHand) {
        const name = productById[productId] ? `${productById[productId].name} · ${productById[productId].packSize}` : "This product";
        violations.push(`${name} exceeds what's in stock — you're selling ${requested} but only ${onHand} is available.`);
      }
    }
    return violations;
  };

  const checkBelowCost = () => {
    const costByProduct = Object.fromEntries(inv.map((r) => [r.product.id, r.avgCostPerUnit]));
    const warnings = [];
    for (const item of items) {
      if (!item.productId || item.unitPrice === "") continue;
      const price = parseFloat(item.unitPrice) || 0;
      const cost = costByProduct[item.productId] || 0;
      const name = productById[item.productId] ? `${productById[item.productId].name} · ${productById[item.productId].packSize}` : "This product";
      if (price <= 0) {
        warnings.push(`${name} is priced at ${money(price)}.`);
      } else if (cost > 0 && price < cost) {
        warnings.push(`${name} is priced at ${money(price)}, below its cost of ${money(cost)}.`);
      }
    }
    return warnings;
  };

  const submit = async (e) => {
    e.preventDefault();
    setFormError("");
    const violations = checkStockAvailability();
    if (violations.length > 0) {
      setFormError(violations.join(" "));
      return;
    }
    const belowCostWarnings = checkBelowCost();
    if (belowCostWarnings.length > 0) {
      const proceed = await confirmAction(`${belowCostWarnings.join(" ")} Save this order anyway?`, { confirmLabel: "Save anyway" });
      if (!proceed) return;
    }
    const paymentDate = date || new Date().toISOString().slice(0, 10);
    const enteredPayments = payments
      .filter((p) => p.amount !== "" && parseFloat(p.amount) > 0)
      .map((p) => ({ amount: parseFloat(p.amount) || 0, mode: p.mode, date: paymentDate }));
    add("salesOrders", {
      customerId,
      date: paymentDate,
      // payments is the real source of truth — a list, not a single
      // amount/mode, so a sale paid partly by POS and partly by cash at
      // the same checkout is recorded as two lines, not one overwriting
      // the other.
      payments: enteredPayments,
      items: items
        .filter((i) => i.productId && i.quantity)
        .map((i) => ({ productId: i.productId, quantity: parseFloat(i.quantity) || 0, unitPrice: parseFloat(i.unitPrice) || 0 })),
    });
    setCustomerId(""); setDate(""); setItems([{ ...blankItem }]); setPayments([{ ...blankPayment }]); setFormError(""); setOpen(false);
  };

  const updatePaymentDraft = (orderId, patch) => setPaymentDrafts((d) => ({ ...d, [orderId]: { ...d[orderId], ...patch } }));
  const addPayment = (order, orderTotalForOrder) => {
    const draft = paymentDrafts[order.id];
    if (!draft?.amount) return;
    const existing = orderPayments(order, orderTotalForOrder);
    const newPayment = { amount: parseFloat(draft.amount) || 0, mode: draft.mode || paymentModes[0], date: new Date().toISOString().slice(0, 10) };
    update("salesOrders", order.id, { payments: [...existing, newPayment] });
    setPaymentDrafts((d) => { const next = { ...d }; delete next[order.id]; return next; });
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
            <div className="grid grid-cols-2 gap-4">
              <Field label="Customer">
                <select className={inputCls} value={customerId} onChange={(e) => setCustomerId(e.target.value)} required>
                  <option value="">Select…</option>
                  {data.customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Date"><input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
            </div>

            <div>
              <div className="chip text-ink-400 uppercase mb-2">Items in this order — price auto-fills from the product's price for this customer's segment</div>
              <div className="space-y-2 overflow-x-auto">
                {items.map((row, i) => (
                  <div key={i} className="grid grid-cols-9 gap-2 items-center min-w-[640px]">
                    <select className={`${inputCls} col-span-4`} value={row.productId} onChange={(e) => onProductSelect(i, e.target.value)}>
                      <option value="">Product…</option>
                      {data.products.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.packSize} — {onHandByProduct[p.id] ?? 0} on hand</option>)}
                    </select>
                    <input type="number" min="0" className={`${inputCls} col-span-2`} placeholder="qty" value={row.quantity} onChange={(e) => { updateItem(i, { quantity: e.target.value }); setFormError(""); }} />
                    <input type="number" min="0" step="0.01" className={`${inputCls} col-span-2`} placeholder="unit price" value={row.unitPrice} onChange={(e) => updateItem(i, { unitPrice: e.target.value })} />
                    <button type="button" className="text-ink-500 hover:text-[var(--accent)] text-xs" onClick={() => setItems(items.filter((_, idx) => idx !== i))}>remove</button>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between mt-2 flex-wrap gap-2">
                <button type="button" className={btnGhostCls} onClick={() => setItems([...items, { ...blankItem }])}>+ add item</button>
                <span className="chip text-ink-300">Order total: <span className="text-[var(--accent)]">{money(orderTotal)}</span></span>
              </div>
            </div>

            <div>
              <div className="chip text-ink-400 uppercase mb-2">
                How the customer is paying — add a line per method if it's split (e.g. part POS, part cash)
              </div>
              <div className="space-y-2">
                {payments.map((row, i) => (
                  <div key={i} className="grid grid-cols-6 gap-2 items-center">
                    <input
                      type="number" min="0" step="0.01"
                      className={`${inputCls} col-span-3`}
                      placeholder="amount"
                      value={row.amount}
                      onChange={(e) => updatePayment(i, { amount: e.target.value })}
                    />
                    <select className={`${inputCls} col-span-2`} value={row.mode} onChange={(e) => updatePayment(i, { mode: e.target.value })}>
                      {paymentModes.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                    {payments.length > 1 && (
                      <button type="button" className="text-ink-500 hover:text-[var(--accent)] text-xs" onClick={() => setPayments(payments.filter((_, idx) => idx !== i))}>remove</button>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between mt-2 flex-wrap gap-2">
                <button type="button" className={btnGhostCls} onClick={() => setPayments([...payments, { ...blankPayment }])}>+ add payment method</button>
                <span className="chip text-ink-400">
                  {balance > 0.004 ? (
                    <>Balance — becomes a <span className="text-[var(--accent)]">receivable</span> of {money(balance)}</>
                  ) : totalEnteredPayments > 0 ? (
                    "Fully paid"
                  ) : (
                    "Leave amounts blank to record this as fully paid"
                  )}
                </span>
              </div>
            </div>

            {formError && (
              <div className="chip px-3 py-2 rounded border border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]">
                ⚠ {formError}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button type="button" className={btnGhostCls} onClick={() => setOpen(false)}>Cancel</button>
              <button type="submit" className={btnCls}>Save order</button>
            </div>
          </form>
        </Panel>
      )}

      <Panel title="Orders" eyebrow="Cost per line uses each product's current weighted-average from production (est.)">
        <div className="space-y-3">
          {orderIds.map((orderId) => {
            const order = orderById[orderId];
            const orderLines = lines.filter((l) => l.orderId === orderId);
            const total = orderLines.reduce((s, l) => s + l.revenue, 0);
            const margin = orderLines.reduce((s, l) => s + l.margin, 0);
            const payments = orderPayments(order, total);
            const paid = orderPaidTotal(order, total);
            const orderBalance = Math.max(0, total - paid);
            return (
              <div key={orderId} className="border border-ink-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <span className="chip text-ink-500">{order.date}</span>
                    <span className="text-sm text-ink-100">{customerById[order.customerId]?.name || "—"}</span>
                  </div>
                  <div className="flex items-center gap-4 flex-wrap">
                    <span className="chip text-ink-300">revenue {money(total)}</span>
                    <span className="chip text-moss-400">margin {money(margin)}</span>
                    {orderBalance > 0.004 ? (
                      <span className="chip text-[var(--accent)]">receivable {money(orderBalance)}</span>
                    ) : (
                      <span className="chip text-ink-500">fully paid</span>
                    )}
                    <button className="text-ink-500 hover:text-[var(--accent)] text-xs" onClick={async () => {
                      if (await confirmAction("Remove this order? This can't be undone.", { danger: true, confirmLabel: "Remove" })) remove("salesOrders", orderId);
                    }}>remove order</button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className="chip text-ink-500">Payments:</span>
                  {payments.map((p, idx) => (
                    <span key={idx} className="chip bg-ink-900 border border-ink-700 rounded px-2 py-0.5 text-ink-300">
                      {money(p.amount)} · {p.mode}{p.date ? ` · ${p.date}` : ""}
                    </span>
                  ))}
                </div>

                {orderBalance > 0.004 && (
                  <div className="mb-3">
                    <div className="chip text-ink-500 mb-1.5">Customer paying off the remaining balance now:</div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <input
                        type="number" min="0" step="0.01"
                        className={`${inputCls} w-28`}
                        placeholder="amount"
                        value={paymentDrafts[orderId]?.amount ?? ""}
                        onChange={(e) => updatePaymentDraft(orderId, { amount: e.target.value })}
                      />
                      <select
                        className={`${inputCls} w-28`}
                        value={paymentDrafts[orderId]?.mode ?? paymentModes[0]}
                        onChange={(e) => updatePaymentDraft(orderId, { mode: e.target.value })}
                      >
                        {paymentModes.map((p) => <option key={p} value={p}>{p}</option>)}
                      </select>
                      <button type="button" className="chip text-[var(--accent)]" onClick={() => addPayment(order, total)}>save</button>
                    </div>
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full text-sm" style={{ minWidth: "600px" }}>
                    <thead>
                      <tr className="text-left chip text-ink-500 uppercase border-b border-ink-700">
                        <th className="py-1.5 pr-4">Product</th>
                        <th className="py-1.5 pr-4 text-right">Qty</th>
                        <th className="py-1.5 pr-4 text-right">Price</th>
                        <th className="py-1.5 pr-4 text-right">Cost (est.)</th>
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
