import { useState } from "react";
import { Link } from "react-router-dom";
import { useApp, useMoney } from "../lib/AppContext";
import { useConfirm } from "../lib/ConfirmContext";
import { salesWithMargin, finishedGoodsInventory, orderPayments, orderPaidTotal, orderCreditTotal, debtDueDate, debtStatus, sortByDateDesc } from "../lib/calc";
import { makeUniqueInvoiceNumber } from "../lib/invoiceNumber";
import { postJournalEntry, journalForSale, journalForPaymentReceived } from "../lib/ledger";
import Panel from "../components/Panel";
import { Field, inputCls, btnCls, btnGhostCls } from "../components/Field";

const paymentModes = ["Cash", "POS", "Transfer", "Credit"];
const blankItem = { productId: "", quantity: "", unitPrice: "", isGiveaway: false };
const blankPayment = { amount: "", mode: "Cash" };

export default function Sales() {
  const { data, add, update, remove } = useApp();
  const money = useMoney();
  const confirmAction = useConfirm();
  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [branch, setBranch] = useState("");
  const [date, setDate] = useState("");
  const [items, setItems] = useState([{ ...blankItem }]);
  const [payments, setPayments] = useState([{ ...blankPayment }]);
  const [vatRate, setVatRate] = useState(data.vatRate ?? 7.5);
  const [receivablesDays, setReceivablesDays] = useState(data.receivablesDays ?? 30);
  const [isSaleOrReturn, setIsSaleOrReturn] = useState(false);
  const [formError, setFormError] = useState("");
  const [paymentDrafts, setPaymentDrafts] = useState({});
  const [returnDrafts, setReturnDrafts] = useState({});
  const [closingOrderId, setClosingOrderId] = useState(null);

  const lines = salesWithMargin(data);
  const inv = finishedGoodsInventory(data);
  const onHandByProduct = Object.fromEntries(inv.map((r) => [r.product.id, r.qtyOnHand]));

  // Group flattened lines back into orders for a cleaner log view.
  const orderIds = [...new Set(sortByDateDesc(data.salesOrders, "date").map((o) => o.id))];
  const orderById = Object.fromEntries(data.salesOrders.map((o) => [o.id, o]));
  const customerById = Object.fromEntries(data.customers.map((c) => [c.id, c]));
  const productById = Object.fromEntries(data.products.map((p) => [p.id, p]));
  const selectedCustomer = customerById[customerId];
  const customerBranches = selectedCustomer?.branches || [];

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

  // Giveaway lines (advertising / charity — no charge) still leave with
  // the customer and still count as stock movement, but they're never
  // billable — they don't count toward the subtotal, VAT, or what the
  // customer owes.
  const subtotal = items.reduce((s, i) => s + (i.isGiveaway ? 0 : (parseFloat(i.quantity) || 0) * (parseFloat(i.unitPrice) || 0)), 0);
  const vatAmount = subtotal * ((parseFloat(vatRate) || 0) / 100);
  const orderTotal = subtotal + vatAmount;
  // A "Credit" line isn't money received — it's a note that this much is
  // being deliberately left on the customer's account. Only genuinely
  // received modes reduce the balance still owed.
  const totalEnteredPayments = payments.reduce((s, p) => s + (p.mode === "Credit" ? 0 : (parseFloat(p.amount) || 0)), 0);
  const totalEnteredCredit = payments.reduce((s, p) => s + (p.mode === "Credit" ? (parseFloat(p.amount) || 0) : 0), 0);
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
      if (!item.productId || item.unitPrice === "" || item.isGiveaway) continue;
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
    const customer = customerById[customerId];
    const invoiceNumber = makeUniqueInvoiceNumber(customer, paymentDate, data.salesOrders.map((o) => o.invoiceNumber), branch || undefined);
    const soldItems = items
      .filter((i) => i.productId && i.quantity)
      .map((i) => ({
        productId: i.productId,
        quantity: parseFloat(i.quantity) || 0,
        unitPrice: i.isGiveaway ? 0 : parseFloat(i.unitPrice) || 0,
        isGiveaway: !!i.isGiveaway,
      }));
    const result = await add("salesOrders", {
      customerId,
      branch: branch || undefined,
      date: paymentDate,
      invoiceNumber,
      vatRate: parseFloat(vatRate) || 0,
      // A Sale-or-Return isn't billed at all yet — no revenue, no VAT —
      // until it's closed, so nothing is charged here; closing it fills
      // this in for real.
      vatAmount: isSaleOrReturn ? 0 : Math.round(vatAmount * 100) / 100,
      // Only meaningful when part of the order is on credit — the number
      // of days the customer has to pay before it's due, defaulting to
      // the business-wide setting but overridable per order.
      receivablesDays: totalEnteredCredit > 0.004 ? (parseFloat(receivablesDays) || 30) : undefined,
      // payments is the real source of truth — a list, not a single
      // amount/mode, so a sale paid partly by POS and partly by cash at
      // the same checkout is recorded as two lines, not one overwriting
      // the other. A "Credit" line here just documents that part was
      // deliberately extended to the customer — see orderPaidTotal. A
      // Sale-or-Return collects nothing upfront — payment (if any) is
      // recorded once the sale is closed and it's clear what's owed.
      payments: isSaleOrReturn ? [] : enteredPayments,
      saleType: isSaleOrReturn ? "sale_or_return" : undefined,
      closed: isSaleOrReturn ? false : undefined,
      items: soldItems,
    });
    // Post to the ledger only after the sale itself is safely saved — a
    // journal-posting hiccup should never be mistaken for a lost sale. A
    // Sale-or-Return posts nothing yet: the goods have left, but nothing
    // has been earned or billed until the sale is closed.
    if (result?.ok !== false && !isSaleOrReturn) {
      const costByProduct = Object.fromEntries(inv.map((r) => [r.product.id, r.avgCostPerUnit]));
      let cogsSold = 0;
      let cogsGiveaway = 0;
      for (const item of soldItems) {
        const cost = (costByProduct[item.productId] || 0) * item.quantity;
        if (item.isGiveaway) cogsGiveaway += cost;
        else cogsSold += cost;
      }
      await postJournalEntry(add, journalForSale(
        { id: result.id, date: paymentDate, invoiceNumber },
        {
          subtotal: Math.round(subtotal * 100) / 100,
          vatAmount: Math.round(vatAmount * 100) / 100,
          cashReceived: totalEnteredPayments,
          receivableDelta: Math.max(0, balance),
          cogsSold,
          cogsGiveaway,
        }
      ));
    }
    setCustomerId(""); setBranch(""); setDate(""); setItems([{ ...blankItem }]); setPayments([{ ...blankPayment }]); setVatRate(data.vatRate ?? 7.5); setReceivablesDays(data.receivablesDays ?? 30); setIsSaleOrReturn(false); setFormError(""); setOpen(false);
  };

  // Closing a Sale-or-Return — the user says how many of each item came
  // back; the rest is assumed kept and becomes billable right now. This
  // is the moment revenue, COGS, and VAT are actually recognized.
  const closeOrReturn = async (order) => {
    const draft = returnDrafts[order.id] || {};
    const updatedItems = (order.items || []).map((item) => {
      const returned = Math.max(0, Math.min(item.quantity, parseFloat(draft[item.productId] ?? item.quantityReturned ?? 0) || 0));
      return { ...item, quantityReturned: returned };
    });
    const keptSubtotal = updatedItems.reduce((s, i) => s + (i.isGiveaway ? 0 : Math.max(0, i.quantity - (i.quantityReturned || 0)) * i.unitPrice), 0);
    const closedVatAmount = Math.round(keptSubtotal * ((order.vatRate || 0) / 100) * 100) / 100;
    const anyReturned = updatedItems.some((i) => (i.quantityReturned || 0) > 0);
    const proceed = await confirmAction(
      anyReturned
        ? `Close this sale? ${money(keptSubtotal + closedVatAmount)} becomes billable to the customer for what they kept; returned units go back into Finished Goods inventory.`
        : `Close this sale? Nothing was marked as returned, so the full ${money(keptSubtotal + closedVatAmount)} becomes billable.`,
      { confirmLabel: "Close sale" }
    );
    if (!proceed) return;
    await update("salesOrders", order.id, {
      items: updatedItems,
      closed: true,
      closedDate: new Date().toISOString().slice(0, 10),
      vatAmount: closedVatAmount,
    });
    setReturnDrafts((d) => { const next = { ...d }; delete next[order.id]; return next; });
    setClosingOrderId(null);
  };

  const updatePaymentDraft = (orderId, patch) => setPaymentDrafts((d) => ({ ...d, [orderId]: { ...d[orderId], ...patch } }));
  // Recording a payment against an already-saved order changes financial
  // history (receivables, what's been collected) — a typed-confirmation-
  // free but explicit confirmation step before it's applied, per the
  // verification-flow request.
  const addPayment = async (order, orderTotalForOrder) => {
    const draft = paymentDrafts[order.id];
    if (!draft?.amount) return;
    const amount = parseFloat(draft.amount) || 0;
    const mode = draft.mode || paymentModes[0];
    const paymentDate = draft.date || new Date().toISOString().slice(0, 10);
    const msg = mode === "Credit"
      ? `Extend ${money(amount)} more of this order on credit (not counted as received)? This updates the balance owed.`
      : `Record ${money(amount)} received via ${mode} on ${paymentDate} for this order? This updates what's owed.`;
    const proceed = await confirmAction(msg, { confirmLabel: "Confirm" });
    if (!proceed) return;
    const existing = orderPayments(order, orderTotalForOrder);
    const newPayment = { amount, mode, date: paymentDate };
    await update("salesOrders", order.id, { payments: [...existing, newPayment] });
    // A genuine (non-Credit) payment moves cash in and shrinks the
    // receivable booked at sale time — a Credit line only documents
    // intent and doesn't move money, so it isn't posted.
    if (mode !== "Credit") {
      await postJournalEntry(add, journalForPaymentReceived(order, amount, paymentDate));
    }
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
        <div className="flex gap-2 flex-wrap">
          <Link to="/sales/dashboard" className={btnGhostCls}>View dashboard →</Link>
          <button className={btnCls} onClick={() => setOpen((o) => !o)}>{open ? "Cancel" : "+ Record a sale"}</button>
        </div>
      </div>

      {open && (
        <Panel title="New sale" eyebrow="One checkout, as many products as the customer is buying">
          <form onSubmit={submit} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Customer">
                <select className={inputCls} value={customerId} onChange={(e) => { setCustomerId(e.target.value); setBranch(""); }} required>
                  <option value="">Select…</option>
                  {data.customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              {customerBranches.length > 0 && (
                <Field label="Delivering to branch">
                  <select className={inputCls} value={branch} onChange={(e) => setBranch(e.target.value)} required>
                    <option value="">Select a branch…</option>
                    {customerBranches.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                </Field>
              )}
              <Field label="Date"><input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
            </div>

            <div>
              <div className="chip text-ink-400 uppercase mb-2">Items in this order — price auto-fills from the product's price for this customer's segment</div>
              <div className="space-y-2 overflow-x-auto">
                {items.map((row, i) => (
                  <div key={i} className="grid grid-cols-10 gap-2 items-center min-w-[720px]">
                    <select className={`${inputCls} col-span-4`} value={row.productId} onChange={(e) => onProductSelect(i, e.target.value)}>
                      <option value="">Product…</option>
                      {data.products.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.packSize} — {onHandByProduct[p.id] ?? 0} on hand</option>)}
                    </select>
                    <input type="number" min="0" className={`${inputCls} col-span-2`} placeholder="qty" value={row.quantity} onChange={(e) => { updateItem(i, { quantity: e.target.value }); setFormError(""); }} />
                    <input
                      type="number" min="0" step="0.01"
                      className={`${inputCls} col-span-2`}
                      placeholder="unit price"
                      value={row.isGiveaway ? "0.00" : row.unitPrice}
                      disabled={row.isGiveaway}
                      onChange={(e) => updateItem(i, { unitPrice: e.target.value })}
                    />
                    <label className="col-span-1 flex items-center gap-1.5 text-xs text-ink-400" title="Given out for advertising or charity — no charge, still leaves inventory">
                      <input type="checkbox" checked={!!row.isGiveaway} onChange={(e) => updateItem(i, { isGiveaway: e.target.checked })} />
                      giveaway
                    </label>
                    <button type="button" className="text-ink-500 hover:text-[var(--accent)] text-xs" onClick={() => setItems(items.filter((_, idx) => idx !== i))}>remove</button>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between mt-2 flex-wrap gap-2">
                <button type="button" className={btnGhostCls} onClick={() => setItems([...items, { ...blankItem }])}>+ add item</button>
                <span className="chip text-ink-500">Some items marked as giveaway are excluded from the billable total below.</span>
              </div>
            </div>

            <label className="flex items-start gap-2.5 text-sm text-ink-300 bg-ink-800 border border-ink-700 rounded-lg px-4 py-3">
              <input type="checkbox" className="mt-0.5" checked={isSaleOrReturn} onChange={(e) => setIsSaleOrReturn(e.target.checked)} />
              <span>
                <span className="text-ink-100">Sale or Return</span> — goods go out on consignment, nothing is billed or collected now.
                No revenue or VAT is recognized until you close the sale and say what actually sold vs. came back.
              </span>
            </label>

            <div>
              <div className="chip text-ink-400 uppercase mb-2">VAT</div>
              <div className="flex items-center gap-3 flex-wrap">
                <Field label="VAT rate (%)">
                  <input type="number" min="0" step="0.1" className={`${inputCls} w-28`} value={vatRate} onChange={(e) => setVatRate(e.target.value)} />
                </Field>
                <span className="chip text-ink-400 mt-4">
                  Subtotal {money(subtotal)} + VAT {money(vatAmount)} = <span className="text-[var(--accent)]">Order total {money(orderTotal)}</span>
                </span>
              </div>
            </div>

            {isSaleOrReturn ? (
              <div className="chip text-ink-400 bg-ink-800 border border-ink-700 rounded-lg px-4 py-3 leading-relaxed normal-case">
                No payment is collected when a Sale-or-Return order is created. Once you close it from the orders list
                below and say what was kept vs. returned, it becomes billable and you can record how the customer pays.
              </div>
            ) : (
              <div>
                <div className="chip text-ink-400 uppercase mb-2">
                  How the customer is paying — add a line per method if it's split (e.g. part POS, part cash). Select "Credit" for any part left on the customer's account, not paid now.
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
                    {totalEnteredCredit > 0.004 && balance > 0.004 ? (
                      <>On <span className="text-[var(--accent)]">credit</span> — balance of {money(balance)}</>
                    ) : balance > 0.004 ? (
                      <>Balance — becomes a <span className="text-[var(--accent)]">receivable</span> of {money(balance)}</>
                    ) : totalEnteredPayments > 0 ? (
                      "Fully paid"
                    ) : (
                      "Leave amounts blank to record this as fully paid"
                    )}
                  </span>
                </div>
                {totalEnteredCredit > 0.004 && (
                  <div className="mt-3">
                    <Field label="Receivables days — how long the customer has to pay this off">
                      <input type="number" min="0" step="1" className={`${inputCls} w-32`} value={receivablesDays} onChange={(e) => setReceivablesDays(e.target.value)} />
                    </Field>
                    <span className="chip text-ink-500 mt-1 block">
                      Due {(() => { const d = new Date(`${(date || new Date().toISOString().slice(0, 10))}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + (parseInt(receivablesDays, 10) || 0)); return d.toISOString().slice(0, 10); })()}
                    </span>
                  </div>
                )}
              </div>
            )}

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
            const revenue = orderLines.reduce((s, l) => s + l.revenue, 0);
            const total = revenue + (order.vatAmount || 0);
            const margin = orderLines.reduce((s, l) => s + l.margin, 0);
            const payments = orderPayments(order, total);
            const paid = orderPaidTotal(order, total);
            const credit = orderCreditTotal(order, total);
            const orderBalance = Math.max(0, total - paid);
            const hasGiveaway = orderLines.some((l) => l.isGiveaway);
            return (
              <div key={orderId} className="border border-ink-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="chip text-ink-500">{order.date}</span>
                    <span className="text-sm text-ink-100">{customerById[order.customerId]?.name || "—"}</span>
                    {order.invoiceNumber && <span className="chip text-ink-500">{order.invoiceNumber}</span>}
                    {order.branch && <span className="chip text-ink-400">→ {order.branch}</span>}
                    {hasGiveaway && <span className="chip text-brass-400">includes giveaway</span>}
                    {order.saleType === "sale_or_return" && (
                      <span className={`chip px-2 py-0.5 rounded border ${order.closed ? "border-ink-700 text-ink-500" : "border-[var(--accent)]/50 text-[var(--accent)]"}`}>
                        Sale or Return {order.closed ? "· closed" : "· open"}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 flex-wrap">
                    {(order.saleType !== "sale_or_return" || order.closed) && <span className="chip text-ink-300">revenue {money(revenue)}</span>}
                    {order.vatAmount > 0 && <span className="chip text-ink-400">VAT {money(order.vatAmount)}</span>}
                    {(order.saleType !== "sale_or_return" || order.closed) && <span className="chip text-moss-400">margin {money(margin)}</span>}
                    {order.saleType === "sale_or_return" && !order.closed ? null : credit > 0.004 && orderBalance > 0.004 ? (
                      <span className="chip text-[var(--accent)]">on credit — balance {money(orderBalance)}</span>
                    ) : orderBalance > 0.004 ? (
                      <span className="chip text-[var(--accent)]">receivable {money(orderBalance)}</span>
                    ) : (
                      <span className="chip text-ink-500">fully paid</span>
                    )}
                    {orderBalance > 0.004 && (() => {
                      const due = debtDueDate(order.date, order.receivablesDays, data.receivablesDays ?? 30);
                      const status = debtStatus(due);
                      return (
                        <span className={`chip ${status === "overdue" ? "text-red-400" : status === "due" ? "text-[var(--accent)]" : "text-ink-500"}`}>
                          due {due}{status === "overdue" ? " · Overdue" : status === "due" ? " · Due" : ""}
                        </span>
                      );
                    })()}
                    <button className="text-ink-500 hover:text-[var(--accent)] text-xs" onClick={async () => {
                      if (await confirmAction("Remove this order? This can't be undone.", { danger: true, confirmLabel: "Remove" })) remove("salesOrders", orderId);
                    }}>remove order</button>
                  </div>
                </div>

                {(order.saleType !== "sale_or_return" || order.closed) && (
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className="chip text-ink-500">Payments:</span>
                    {payments.map((p, idx) => (
                      <span key={idx} className={`chip bg-ink-900 border rounded px-2 py-0.5 ${p.mode === "Credit" ? "border-[var(--accent)]/50 text-[var(--accent)]" : "border-ink-700 text-ink-300"}`}>
                        {money(p.amount)} · {p.mode}{p.date ? ` · ${p.date}` : ""}
                      </span>
                    ))}
                    {payments.length === 0 && <span className="chip text-ink-500">none yet</span>}
                  </div>
                )}

                {order.saleType === "sale_or_return" && !order.closed && (
                  <div className="mb-3 bg-ink-900/40 border border-ink-700 rounded-lg p-3">
                    {closingOrderId === orderId ? (
                      <div className="space-y-2">
                        <div className="chip text-ink-400 uppercase mb-1">How many of each came back? The rest is assumed kept.</div>
                        {(order.items || []).map((item) => (
                          <div key={item.productId} className="flex items-center justify-between gap-3 text-sm">
                            <span className="text-ink-200">{productById[item.productId] ? `${productById[item.productId].name} · ${productById[item.productId].packSize}` : "—"} <span className="chip text-ink-500">shipped {item.quantity}</span></span>
                            <input
                              type="number" min="0" max={item.quantity} step="1"
                              className={`${inputCls} w-24`}
                              placeholder="returned"
                              value={returnDrafts[orderId]?.[item.productId] ?? item.quantityReturned ?? ""}
                              onChange={(e) => setReturnDrafts((d) => ({ ...d, [orderId]: { ...d[orderId], [item.productId]: e.target.value } }))}
                            />
                          </div>
                        ))}
                        <div className="flex justify-end gap-2 pt-1">
                          <button type="button" className={btnGhostCls} onClick={() => setClosingOrderId(null)}>Cancel</button>
                          <button type="button" className={btnCls} onClick={() => closeOrReturn(order)}>Close sale</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <span className="chip text-ink-400">Out with the customer on consignment — not yet billed.</span>
                        <button type="button" className={btnGhostCls} onClick={() => setClosingOrderId(orderId)}>Close sale — record returns</button>
                      </div>
                    )}
                  </div>
                )}

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
                      <input
                        type="date"
                        className={`${inputCls} w-40`}
                        title="Date the payment came in"
                        value={paymentDrafts[orderId]?.date ?? ""}
                        onChange={(e) => updatePaymentDraft(orderId, { date: e.target.value })}
                      />
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
                          <td className="py-1.5 pr-4">
                            {l.product ? `${l.product.name} · ${l.product.packSize}` : "—"}
                            {l.isGiveaway && <span className="chip text-brass-400 ml-2">giveaway</span>}
                            {l.isSaleOrReturn && l.returnedQty > 0 && <span className="chip text-[var(--accent)] ml-2">{l.returnedQty} returned</span>}
                          </td>
                          <td className="py-1.5 pr-4 text-right chip">{l.isSaleOrReturn && l.closed ? `${l.keptQty} kept` : l.quantity}</td>
                          <td className="py-1.5 pr-4 text-right chip">{l.isGiveaway ? "no charge" : money(l.unitPrice)}</td>
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
