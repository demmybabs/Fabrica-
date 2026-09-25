import { toBase, baseUnitOf, convert } from "./uom";

// Parse a pack size string like "500g", "1kg", "250ml" into a base-unit
// number, so we can weight cost allocation across differently sized
// products from the same production run.
export function parsePackSize(packSize) {
  const match = String(packSize).match(/([\d.]+)\s*([a-zA-Z]+)/);
  if (!match) return 1;
  const [, num, unit] = match;
  const base = toBase(parseFloat(num), unit.toLowerCase());
  return base || parseFloat(num);
}

// Suggests which materials to list on a production run, based on the union
// of ingredient names across the products selected as outputs. Quantities
// are left for the user to enter — the recipe only tracks which materials
// go into a product, not how much (see estimateIngredientAllocation for how
// actual usage is estimated per product afterward).
export function suggestInputsForOutputs(outputs, productById) {
  const seen = new Set();
  const rows = [];
  for (const o of outputs) {
    const product = productById[o.productId];
    if (!product) continue;
    for (const ing of product.ingredients || []) {
      if (!seen.has(ing.itemName)) {
        seen.add(ing.itemName);
        rows.push({ itemName: ing.itemName, quantity: "", unit: "kg" });
      }
    }
  }
  return rows;
}

// Reads the quantity actually produced for an output line. New-style runs
// don't ask for a quantity up front anymore — only the physical count after
// production sets it. Older runs (from before this changed) already have a
// `quantity` entered the old way; those keep working exactly as before by
// falling back to it until/unless a physical count is saved for that line.
function effectiveQty(o) {
  return o.countedQuantity ?? o.quantity ?? 0;
}

// Once a run's actual materials (with real quantities) and output products
// are logged, estimate how much of each material went to each product —
// split by output weight share, but only among the products whose recipe
// actually lists that ingredient (so an ingredient exclusive to one flavor
// in a mixed run doesn't get spread across flavors that don't use it).
export function estimateIngredientAllocation(run, productById) {
  const outputs = run.outputs.map((o) => ({ ...o, product: productById[o.productId] }));
  const result = {};
  for (const input of run.inputs) {
    const eligible = outputs.filter((o) => o.product?.ingredients?.some((ing) => ing.itemName === input.itemName));
    const useOutputs = eligible.length > 0 ? eligible : outputs;
    const totalWeight = useOutputs.reduce((s, o) => s + parsePackSize(o.product?.packSize || "1unit") * effectiveQty(o), 0) || 1;
    result[input.itemName] = useOutputs.map((o) => {
      const w = parsePackSize(o.product?.packSize || "1unit") * effectiveQty(o);
      return {
        productId: o.productId,
        product: o.product,
        quantity: input.quantity * (w / totalWeight),
        unit: input.unit,
      };
    });
  }
  return result;
}

// Materials ledger: what's been supplied, what's been consumed in
// production, and what's left — all converted to a common base unit
// per material so kg/g/lb all reconcile.
export function materialLedger(data) {
  const { supplyBatches, productionRuns, customUnits } = data;
  const byItem = {};

  const ensure = (itemName, unit) => {
    if (!byItem[itemName]) {
      byItem[itemName] = {
        itemName,
        baseUnit: baseUnitOf(unit, customUnits),
        displayUnit: unit,
        suppliedBase: 0,
        costSupplied: 0,
        paid: 0,
        consumedBase: 0,
      };
    }
    return byItem[itemName];
  };

  for (const b of supplyBatches) {
    const row = ensure(b.itemName, b.unit);
    row.suppliedBase += toBase(b.quantity, b.unit, customUnits);
    row.costSupplied += b.totalCost;
    row.paid += b.amountPaid || 0;
  }

  for (const run of productionRuns) {
    for (const input of run.inputs) {
      const row = ensure(input.itemName, input.unit);
      row.consumedBase += toBase(input.quantity, input.unit, customUnits);
    }
  }

  const spoiledBaseByItem = {};
  for (const s of data.spoilage || []) {
    if (s.kind !== "material" || !s.itemName) continue;
    spoiledBaseByItem[s.itemName] = (spoiledBaseByItem[s.itemName] || 0) + toBase(s.quantity, s.unit, customUnits);
  }

  return Object.values(byItem).map((row) => {
    const avgUnitCostBase = row.suppliedBase > 0 ? row.costSupplied / row.suppliedBase : 0;
    const spoiledBase = spoiledBaseByItem[row.itemName] || 0;
    const remainingBase = row.suppliedBase - row.consumedBase - spoiledBase;
    return {
      ...row,
      avgUnitCostBase,
      spoiledBase,
      remainingBase,
      remainingDisplay: convert(remainingBase, row.baseUnit, row.displayUnit, customUnits) ?? remainingBase,
      valueRemaining: remainingBase * avgUnitCostBase,
      payable: row.costSupplied - row.paid,
    };
  });
}

// Cost of a single production run, allocated across its output products by
// weight share (a 1kg pack absorbs ~2x the cost of a 500g pack from the
// same batch) rather than split evenly per unit. Overhead is now a list of
// categorised costs (electricity, water, etc), summed into the total.
//
// Weight share includes both the good (counted) quantity AND anything
// logged as lost in production for that line — a batch that lost units
// during the process still consumed its share of materials/labor/overhead,
// so its cost is real even though it never reached inventory. That lost
// share is reported separately as lossValue, not folded into costPerUnit.
export function productionRunCosts(run, ledger, productById) {
  const ledgerByItem = Object.fromEntries(ledger.map((r) => [r.itemName, r]));
  const materialCost = run.inputs.reduce((sum, input) => {
    const row = ledgerByItem[input.itemName];
    const qtyBase = toBase(input.quantity, input.unit);
    return sum + qtyBase * (row?.avgUnitCostBase || 0);
  }, 0);
  const overheadTotal = (run.overheadCosts || []).reduce((s, o) => s + (o.cost || 0), 0);
  const totalRunCost = materialCost + (run.laborCost || 0) + overheadTotal;

  const outputsWithWeight = run.outputs.map((o) => {
    const product = productById[o.productId];
    const packWeight = parsePackSize(product?.packSize || "1unit");
    const qty = effectiveQty(o);
    const lossQty = o.lossQuantity || 0;
    return {
      ...o,
      product,
      quantity: qty,
      lossQuantity: lossQty,
      isCounted: o.countedQuantity !== undefined,
      weightShare: packWeight * (qty + lossQty),
    };
  });
  const totalWeight = outputsWithWeight.reduce((s, o) => s + o.weightShare, 0) || 1;

  return {
    materialCost,
    overheadTotal,
    totalRunCost,
    outputs: outputsWithWeight.map((o) => {
      const perUnitCost = totalRunCost * (parsePackSize(o.product?.packSize || "1unit") / totalWeight);
      return {
        ...o,
        costAllocated: perUnitCost * o.quantity,
        costPerUnit: perUnitCost,
        lossValue: perUnitCost * o.lossQuantity,
      };
    }),
  };
}

// Every run's production-loss lines flattened into one list, with the
// value lost estimated at the same per-unit cost as the good units from
// that run (same materials, same process — just didn't make it to
// inventory). This is distinct from Inventory's spoilage log, which
// tracks stock that spoiled AFTER being counted in and stored.
export function productionLosses(data) {
  const ledger = materialLedger(data);
  const productById = Object.fromEntries(data.products.map((p) => [p.id, p]));
  const rows = [];
  for (const run of data.productionRuns) {
    const { outputs } = productionRunCosts(run, ledger, productById);
    for (const o of outputs) {
      if (o.lossQuantity > 0) {
        rows.push({
          runId: run.id,
          batchCode: run.batchCode,
          date: run.date,
          product: o.product,
          productId: o.productId,
          lossQuantity: o.lossQuantity,
          lossValue: o.lossValue,
        });
      }
    }
  }
  return rows;
}

// Finished-goods inventory: quantity on hand and weighted-average cost per
// unit for every product, built from every production run that made it,
// minus what's been sold or marked as spoiled.
export function finishedGoodsInventory(data) {
  const { products, productionRuns, salesOrders, spoilage } = data;
  const ledger = materialLedger(data);
  const productById = Object.fromEntries(products.map((s) => [s.id, s]));

  const produced = {};
  for (const run of productionRuns) {
    const { outputs } = productionRunCosts(run, ledger, productById);
    for (const o of outputs) {
      if (!produced[o.productId]) produced[o.productId] = { qty: 0, cost: 0 };
      produced[o.productId].qty += o.quantity;
      produced[o.productId].cost += o.costAllocated;
    }
  }

  const sold = {};
  for (const order of salesOrders) {
    const isSOR = order.saleType === "sale_or_return";
    for (const item of order.items || []) {
      // A Sale-or-Return item physically leaves the shelf at shipment
      // (whether or not it's been billed yet) and comes back on-hand the
      // moment it's recorded as returned — independent of whether the
      // sale itself has been closed.
      const returned = isSOR ? (item.quantityReturned || 0) : 0;
      sold[item.productId] = (sold[item.productId] || 0) + item.quantity - returned;
    }
  }
  const spoiled = {};
  for (const s of spoilage || []) {
    if (s.kind !== "product" || !s.productId) continue;
    spoiled[s.productId] = (spoiled[s.productId] || 0) + s.quantity;
  }

  return products.map((product) => {
    const p = produced[product.id] || { qty: 0, cost: 0 };
    const avgCostPerUnit = p.qty > 0 ? p.cost / p.qty : 0;
    const qtyOnHand = p.qty - (sold[product.id] || 0) - (spoiled[product.id] || 0);
    return {
      product,
      producedQty: p.qty,
      soldQty: sold[product.id] || 0,
      spoiledQty: spoiled[product.id] || 0,
      qtyOnHand,
      avgCostPerUnit,
      valueOnHand: qtyOnHand * avgCostPerUnit,
    };
  });
}

// Flattens every sales order into one row per line item, enriched with
// cost-of-goods and margin using each product's current weighted-average
// production cost.
export function salesWithMargin(data) {
  const inv = finishedGoodsInventory(data);
  const costByProduct = Object.fromEntries(inv.map((r) => [r.product.id, r.avgCostPerUnit]));
  const customerById = Object.fromEntries(data.customers.map((c) => [c.id, c]));
  const productById = Object.fromEntries(data.products.map((s) => [s.id, s]));

  const rows = [];
  for (const order of data.salesOrders) {
    const isSOR = order.saleType === "sale_or_return";
    for (const item of order.items || []) {
      const costPerUnit = costByProduct[item.productId] || 0;
      // A giveaway line (advertising/charity — no charge) never counts as
      // revenue, whatever price happens to be stored on it. It still
      // consumes inventory and carries a real cost, which is what makes
      // it worth tracking separately rather than just leaving it off.
      const isGiveaway = !!item.isGiveaway;
      // A Sale-or-Return item is on consignment — the units the customer
      // actually keeps (shipped minus returned) are what's ever billable,
      // and neither revenue nor its cost is recognized until the sale is
      // closed, so an open one contributes nothing to either yet.
      const returned = isSOR ? (item.quantityReturned || 0) : 0;
      const keptQty = Math.max(0, item.quantity - returned);
      const billable = !isSOR || !!order.closed;
      const revenue = isGiveaway || !billable ? 0 : keptQty * item.unitPrice;
      const cogsQty = isSOR ? (billable ? keptQty : 0) : item.quantity;
      const cogs = cogsQty * costPerUnit;
      rows.push({
        id: `${order.id}::${item.productId}`,
        orderId: order.id,
        // Revenue for a closed Sale-or-Return is earned the day it's
        // closed, not the day the goods first went out — so it lands in
        // the right income-statement period.
        date: isSOR && order.closed ? (order.closedDate || order.date) : order.date,
        paymentMode: summarizePaymentModes(orderPayments(order, null)),
        customer: customerById[order.customerId],
        customerId: order.customerId,
        product: productById[item.productId],
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        costPerUnit,
        isGiveaway,
        isSaleOrReturn: isSOR,
        returnedQty: returned,
        keptQty,
        closed: !isSOR || !!order.closed,
        revenue,
        cogs,
        margin: revenue - cogs,
        marginPct: revenue > 0 ? ((revenue - cogs) / revenue) * 100 : 0,
      });
    }
  }
  return rows;
}

// Whether an order is an open (not yet closed) Sale-or-Return — a
// consignment-style sale where the customer can return unsold units
// before anything is billed. No revenue, cost of goods, or receivable is
// recognized for one of these until it's closed.
export function isOpenSaleOrReturn(order) {
  return order.saleType === "sale_or_return" && !order.closed;
}

// What's actually billable on an order — every non-giveaway line's
// quantity × price for an ordinary sale; for a Sale-or-Return, only the
// units the customer has kept (quantity minus whatever's been returned),
// and nothing at all until the sale is closed.
export function orderBillableSubtotal(order) {
  if (isOpenSaleOrReturn(order)) return 0;
  const isSOR = order.saleType === "sale_or_return";
  return (order.items || []).reduce((sum, i) => {
    if (i.isGiveaway) return sum;
    const kept = isSOR ? Math.max(0, i.quantity - (i.quantityReturned || 0)) : i.quantity;
    return sum + kept * i.unitPrice;
  }, 0);
}

export function orderBillableTotal(order) {
  return orderBillableSubtotal(order) * (1 + (order.vatRate || 0) / 100);
}

// Every open Sale-or-Return order — what's out with customers on
// consignment but not yet recognized as revenue, for the Sales dashboard.
export function openSaleOrReturnOrders(data) {
  const customerById = Object.fromEntries(data.customers.map((c) => [c.id, c]));
  return (data.salesOrders || [])
    .filter((o) => isOpenSaleOrReturn(o))
    .map((order) => {
      const items = order.items || [];
      const value = items.reduce((s, i) => s + (i.isGiveaway ? 0 : i.quantity * i.unitPrice), 0);
      const productCount = new Set(items.map((i) => i.productId)).size;
      const anyReturned = items.some((i) => (i.quantityReturned || 0) > 0);
      return {
        order,
        customer: customerById[order.customerId],
        customerName: customerById[order.customerId]?.name || "—",
        value,
        productCount,
        date: order.date,
        anyReturned,
      };
    })
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

// Total value (at selling price) currently out on open Sale-or-Return —
// the "hasn't been closed yet" figure requested for the Sales/Overview
// dashboards.
export function saleOrReturnOpenValue(data) {
  return openSaleOrReturnOrders(data).reduce((s, r) => s + r.value, 0);
}

// Every giveaway line (advertising / charity — items given out at no
// charge) across all orders, with the cost value of what was given away
// estimated at the same weighted-average production cost used everywhere
// else. Units still count toward stock movement (finishedGoodsInventory
// already treats every item line the same way regardless of price).
export function givingSummary(data, range = {}) {
  const lines = salesWithMargin(data).filter((s) => s.isGiveaway && inRange(s.date, range.from, range.to));
  return {
    units: lines.reduce((s, l) => s + l.quantity, 0),
    value: lines.reduce((s, l) => s + l.cogs, 0),
    orders: new Set(lines.map((l) => l.orderId)).size,
    lines,
  };
}

export function customerAnalytics(data) {
  const lines = salesWithMargin(data);
  const byCustomer = {};
  const orderIdsByCustomer = {};
  for (const s of lines) {
    if (!s.customer) continue;
    const id = s.customer.id;
    if (!byCustomer[id]) {
      byCustomer[id] = { customer: s.customer, orders: 0, revenue: 0, margin: 0, lastDate: s.date };
      orderIdsByCustomer[id] = new Set();
    }
    orderIdsByCustomer[id].add(s.orderId);
    byCustomer[id].revenue += s.revenue;
    byCustomer[id].margin += s.margin;
    if (s.date > byCustomer[id].lastDate) byCustomer[id].lastDate = s.date;
  }
  for (const id of Object.keys(byCustomer)) {
    byCustomer[id].orders = orderIdsByCustomer[id].size;
  }

  const balanceByCustomer = {};
  for (const order of data.salesOrders) {
    const total = orderBillableSubtotal(order);
    const paid = orderPaidTotal(order, total);
    const balance = Math.max(0, total - paid);
    if (balance > 0) balanceByCustomer[order.customerId] = (balanceByCustomer[order.customerId] || 0) + balance;
  }

  return data.customers.map((c) => ({
    ...(byCustomer[c.id] || { customer: c, orders: 0, revenue: 0, margin: 0, lastDate: null }),
    balance: balanceByCustomer[c.id] || 0,
  }));
}

// Groups sales performance by a customer attribute (segment, gender, or
// profession) so Customers can show "who buys the most" at a glance.
export function performanceByAttribute(data, attribute) {
  const lines = salesWithMargin(data);
  const groups = {};
  for (const line of lines) {
    const key = line.customer?.[attribute] || "Unspecified";
    if (!groups[key]) groups[key] = { key, revenue: 0, margin: 0, orders: new Set(), customers: new Set() };
    groups[key].revenue += line.revenue;
    groups[key].margin += line.margin;
    groups[key].orders.add(line.orderId);
    if (line.customerId) groups[key].customers.add(line.customerId);
  }
  return Object.values(groups)
    .map((g) => ({ key: g.key, revenue: g.revenue, margin: g.margin, orders: g.orders.size, customers: g.customers.size }))
    .sort((a, b) => b.revenue - a.revenue);
}

// Estimates the value lost for a spoilage entry before it's saved, so the
// form can show a live preview. Products use a reference selling price
// (the first price set across segments); raw materials use their current
// average supply cost. Returns { value, basis } — basis explains what the
// estimate is built on, since selling price isn't a single fixed number
// once pricing varies by segment/customer.
export function estimateSpoilageValue(data, { kind, productId, itemName, quantity, unit }) {
  const qty = parseFloat(quantity) || 0;
  if (kind === "product") {
    const product = data.products.find((p) => p.id === productId);
    const prices = Object.values(product?.pricesBySegment || {});
    if (prices.length > 0) {
      return { value: qty * prices[0], basis: `at ${data.segments[0] || "its"} selling price` };
    }
    const inv = finishedGoodsInventory(data).find((r) => r.product.id === productId);
    return { value: qty * (inv?.avgCostPerUnit || 0), basis: "at average production cost (no selling price set)" };
  }
  if (kind === "material") {
    const ledger = materialLedger(data);
    const row = ledger.find((r) => r.itemName === itemName);
    if (!row) return { value: 0, basis: "no supply cost on file yet" };
    const qtyBase = toBase(qty, unit, data.customUnits);
    return { value: qtyBase * row.avgUnitCostBase, basis: "at average supply cost" };
  }
  return { value: 0, basis: "" };
}
export function inRange(dateStr, from, to) {
  if (!dateStr) return false;
  if (from && dateStr < from) return false;
  if (to && dateStr > to) return false;
  return true;
}

// Runs where at least one output has neither a physical count nor a
// legacy logged quantity — meaning it's contributing zero to recorded
// inventory even though it physically exists. This is a visibility flag,
// not an enforcement: it doesn't block anything, it just makes sure an
// uncounted batch can't quietly go unnoticed.
export function runsAwaitingCount(data) {
  const today = new Date();
  return data.productionRuns
    .filter((run) => run.outputs.some((o) => o.countedQuantity === undefined && o.quantity === undefined))
    .map((run) => {
      const daysSince = Math.floor((today - new Date(run.date + "T00:00:00")) / (1000 * 60 * 60 * 24));
      return { run, daysSince: Math.max(0, daysSince) };
    })
    .sort((a, b) => b.daysSince - a.daysSince);
}

// An order may have a real `payments` list (one or more entries, each its
// own amount/mode/date — supports paying part by POS and the rest by
// transfer, for example) or, for orders created before this existed,
// just the old single amountPaid/paymentMode pair. This reads either
// shape and always returns a list, so callers don't need to know which
// one they're looking at.
export function orderPayments(order, orderTotal) {
  if (order.payments && order.payments.length > 0) return order.payments;
  const amount = order.amountPaid ?? orderTotal;
  return [{ amount, mode: order.paymentMode || "Cash", date: order.date }];
}

// A "Credit" line in the payments list isn't money that came in — it's a
// record that this much of the order was deliberately extended to the
// customer to pay later. Counting it toward "paid" was the bug behind
// credit sales showing as fully paid: it made money the business never
// received look collected. Only genuinely-received modes count here.
export function orderPaidTotal(order, orderTotal) {
  return orderPayments(order, orderTotal)
    .filter((p) => p.mode !== "Credit")
    .reduce((s, p) => s + (p.amount || 0), 0);
}

// The portion of an order explicitly marked as extended on credit (as
// opposed to a balance that's simply unpaid without anyone saying why).
export function orderCreditTotal(order, orderTotal) {
  return orderPayments(order, orderTotal)
    .filter((p) => p.mode === "Credit")
    .reduce((s, p) => s + (p.amount || 0), 0);
}

export function summarizePaymentModes(payments) {
  const modes = [...new Set(payments.map((p) => p.mode).filter(Boolean))];
  if (modes.length === 0) return "—";
  if (modes.length === 1) return modes[0];
  return "Mixed";
}

// Sorts any list of records by a date field, most recent first — used
// everywhere a module's log/register is displayed, so it reads newest to
// oldest regardless of the order records were entered or backdated in.
// Ties keep their original relative order (stable sort).
export function sortByDateDesc(list, dateField = "date") {
  return [...(list || [])]
    .map((item, i) => ({ item, i }))
    .sort((a, b) => {
      const da = a.item[dateField] || "";
      const db = b.item[dateField] || "";
      if (da !== db) return da < db ? 1 : -1;
      return b.i - a.i;
    })
    .map(({ item }) => item);
}

// Adds whole days to a "YYYY-MM-DD" date string, working in UTC so it's
// never off by one across a daylight-saving boundary.
function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + Math.round(days || 0));
  return d.toISOString().slice(0, 10);
}

// A debt's (receivable or payable) due date — the date it was incurred
// plus however many days of credit were extended, falling back to the
// business-wide default (30 days, as agreed) when nothing more specific
// was set on the record itself.
export function debtDueDate(incurredDate, days, defaultDays = 30) {
  return addDays(incurredDate, days ?? defaultDays);
}

// Where a debt sits relative to its due date, today: "current" (not yet
// due), "due" (due date has arrived, within the 5-day grace period), or
// "overdue" (more than 5 days past due) — the thresholds requested for
// both the Debtors and Creditors views.
export function debtStatus(dueDate, asOf = new Date().toISOString().slice(0, 10)) {
  if (asOf < dueDate) return "current";
  const graceEnd = addDays(dueDate, 5);
  return asOf > graceEnd ? "overdue" : "due";
}

// The full list of open debtors (customers with an outstanding balance),
// one row per order still owing money — an order-level (not just
// customer-level) view, since each order carries its own due date.
export function debtorsList(data, asOf = new Date().toISOString().slice(0, 10)) {
  const customerById = Object.fromEntries(data.customers.map((c) => [c.id, c]));
  const defaultDays = data.receivablesDays ?? 30;
  const rows = [];
  for (const order of data.salesOrders) {
    const total = orderBillableTotal(order);
    const paid = orderPaidTotal(order, total);
    const balance = Math.max(0, total - paid);
    if (balance <= 0.004) continue;
    // A closed Sale-or-Return is due from the day it was closed (billed),
    // not the day the goods first shipped.
    const incurredDate = order.saleType === "sale_or_return" ? (order.closedDate || order.date) : order.date;
    const dueDate = debtDueDate(incurredDate, order.receivablesDays, defaultDays);
    rows.push({
      order,
      customer: customerById[order.customerId],
      customerName: customerById[order.customerId]?.name || "—",
      invoiceNumber: order.invoiceNumber,
      balance,
      date: incurredDate,
      dueDate,
      status: debtStatus(dueDate, asOf),
    });
  }
  return rows.sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0));
}

// Same idea for suppliers — one row per delivery still owed for.
export function creditorsList(data, asOf = new Date().toISOString().slice(0, 10)) {
  const supplierById = Object.fromEntries(data.suppliers.map((s) => [s.id, s]));
  const defaultDays = data.payablesDays ?? 30;
  const rows = [];
  for (const batch of data.supplyBatches) {
    const balance = Math.max(0, (batch.totalCost || 0) - (batch.amountPaid || 0));
    if (balance <= 0.004) continue;
    const dueDate = debtDueDate(batch.dateReceived, batch.payablesDays, defaultDays);
    rows.push({
      batch,
      supplier: supplierById[batch.supplierId],
      supplierName: supplierById[batch.supplierId]?.name || "—",
      itemName: batch.itemName,
      balance,
      date: batch.dateReceived,
      dueDate,
      status: debtStatus(dueDate, asOf),
    });
  }
  return rows.sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0));
}

export function overviewMetrics(data, range = {}) {
  const { from, to } = range;
  const allLines = salesWithMargin(data);
  const lines = allLines.filter((s) => inRange(s.date, from, to) && !s.isGiveaway);
  const givingLines = allLines.filter((s) => s.isGiveaway && inRange(s.date, from, to));
  const ledger = materialLedger(data);
  const inv = finishedGoodsInventory(data);

  const totalRevenue = lines.reduce((s, r) => s + r.revenue, 0);
  const totalCogs = lines.reduce((s, r) => s + r.cogs, 0);
  const grossProfit = totalRevenue - totalCogs;
  const grossMarginPct = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
  const activeCustomers = new Set(lines.map((s) => s.customerId)).size;
  const inventoryValue = inv.reduce((s, r) => s + r.valueOnHand, 0) + ledger.reduce((s, r) => s + r.valueRemaining, 0);
  const payables = ledger.reduce((s, r) => s + r.payable, 0);
  const ordersInRange = data.salesOrders.filter((o) => inRange(o.date, from, to));
  const receivables = data.salesOrders.reduce((s, order) => {
    const total = orderBillableSubtotal(order);
    const paid = orderPaidTotal(order, total);
    return s + Math.max(0, total - paid);
  }, 0);
  const onCredit = data.salesOrders.reduce((s, order) => {
    const total = orderBillableSubtotal(order);
    return s + orderCreditTotal(order, total);
  }, 0);
  const vatCollected = ordersInRange.reduce((s, o) => s + (o.vatAmount || 0), 0);
  // "Closed" is always true for an ordinary sale, so keptQty (== quantity
  // there) is what counts; an open Sale-or-Return contributes nothing —
  // its units haven't been sold yet, just shipped out on consignment.
  const unitsSold = lines.reduce((s, r) => s + (r.closed ? r.keptQty : 0), 0);
  const saleOrReturnOpenValue = openSaleOrReturnOrders(data).reduce((s, r) => s + r.value, 0);
  const orderCount = new Set(lines.map((r) => r.orderId)).size;
  const givingUnits = givingLines.reduce((s, r) => s + r.quantity, 0);
  const givingValue = givingLines.reduce((s, r) => s + r.cogs, 0);
  const lossRows = productionLosses(data).filter((r) => inRange(r.date, from, to));
  const productionLossValue = lossRows.reduce((s, r) => s + r.lossValue, 0);
  const productionLossUnits = lossRows.reduce((s, r) => s + r.lossQuantity, 0);
  const spoilageValue = (data.spoilage || []).filter((s) => inRange(s.date, from, to)).reduce((s, r) => s + (r.valueLost || 0), 0);

  return {
    totalRevenue,
    totalCogs,
    grossProfit,
    grossMarginPct,
    activeCustomers,
    inventoryValue,
    payables,
    receivables,
    onCredit,
    vatCollected,
    unitsSold,
    orderCount,
    givingUnits,
    givingValue,
    productionLossValue,
    productionLossUnits,
    spoilageValue,
    saleOrReturnOpenValue,
  };
}

// Buckets sales lines into weekly / monthly / yearly periods for trend
// charts. Returns points sorted chronologically with revenue, COGS, gross
// profit, and margin % per bucket.
function bucketKey(dateStr, groupBy) {
  const d = new Date(dateStr + "T00:00:00");
  if (groupBy === "yearly") return dateStr.slice(0, 4);
  if (groupBy === "weekly") {
    const day = (d.getDay() + 6) % 7; // Monday = 0
    const monday = new Date(d);
    monday.setDate(d.getDate() - day);
    return monday.toISOString().slice(0, 10);
  }
  return dateStr.slice(0, 7); // monthly: YYYY-MM
}

function bucketLabel(key, groupBy) {
  if (groupBy === "yearly") return key;
  if (groupBy === "weekly") {
    const d = new Date(key + "T00:00:00");
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }
  const [y, m] = key.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString(undefined, { month: "short", year: "2-digit" });
}

// Ranks products by revenue or units sold (real sales only — giveaways
// excluded from revenue automatically since their revenue is already 0,
// but still show up under units if includeGiveaways is true).
export function topProducts(data, range = {}, by = "revenue", limit = 5) {
  // An open Sale-or-Return line isn't a sale yet (see salesWithMargin) —
  // excluded here the same way a giveaway is, so it doesn't inflate
  // "top products" before it's actually been earned.
  const lines = salesWithMargin(data).filter((s) => inRange(s.date, range.from, range.to) && !s.isGiveaway && s.closed);
  const groups = {};
  for (const l of lines) {
    const key = l.productId || "—";
    if (!groups[key]) groups[key] = { product: l.product, revenue: 0, quantity: 0, margin: 0 };
    groups[key].revenue += l.revenue;
    groups[key].quantity += l.keptQty;
    groups[key].margin += l.margin;
  }
  return Object.values(groups).sort((a, b) => b[by] - a[by]).slice(0, limit);
}

// Ranks raw materials by total amount spent (lifetime — supply cost isn't
// date-ranged the way sales are, since a delivery's cost is fixed at
// receipt regardless of when it's later consumed).
export function topMaterialsBySpend(data, limit = 5) {
  return [...materialLedger(data)].sort((a, b) => b.costSupplied - a.costSupplied).slice(0, limit);
}

export function topSuppliersBySpend(data, limit = 5) {
  const bySupplier = {};
  for (const b of data.supplyBatches) {
    if (!b.supplierId) continue;
    if (!bySupplier[b.supplierId]) bySupplier[b.supplierId] = { supplierId: b.supplierId, spend: 0, deliveries: 0 };
    bySupplier[b.supplierId].spend += b.totalCost;
    bySupplier[b.supplierId].deliveries += 1;
  }
  const supplierById = Object.fromEntries(data.suppliers.map((s) => [s.id, s]));
  return Object.values(bySupplier)
    .map((r) => ({ ...r, supplier: supplierById[r.supplierId] }))
    .sort((a, b) => b.spend - a.spend)
    .slice(0, limit);
}

// How revenue in range splits across payment modes — Cash/POS/Transfer add
// up to what was actually collected; Credit is shown too since it's real
// business activity, just not yet collected.
export function paymentModeBreakdown(data, range = {}) {
  const orders = data.salesOrders.filter((o) => inRange(o.date, range.from, range.to));
  const totals = {};
  for (const order of orders) {
    const total = (order.items || []).reduce((s, i) => s + i.quantity * i.unitPrice, 0);
    for (const p of orderPayments(order, total)) {
      const mode = p.mode || "Cash";
      totals[mode] = (totals[mode] || 0) + (p.amount || 0);
    }
  }
  return Object.entries(totals).map(([mode, amount]) => ({ mode, amount }));
}

// Supply batches with an expiry date that's already passed or is coming
// up within `withinDays` — a simple, visible early-warning list rather
// than anything that blocks or auto-removes stock.
export function expiringBatches(data, withinDays = 30) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return data.supplyBatches
    .filter((b) => b.expiryDate)
    .map((b) => {
      const expiry = new Date(b.expiryDate + "T00:00:00");
      const daysLeft = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
      return { batch: b, daysLeft, expired: daysLeft < 0 };
    })
    .filter((r) => r.daysLeft <= withinDays)
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

export function salesTrend(data, range = {}, groupBy = "monthly") {
  const { from, to } = range;
  const lines = salesWithMargin(data).filter((s) => inRange(s.date, from, to));
  const buckets = {};
  for (const line of lines) {
    const key = bucketKey(line.date, groupBy);
    if (!buckets[key]) buckets[key] = { key, revenue: 0, cogs: 0 };
    buckets[key].revenue += line.revenue;
    buckets[key].cogs += line.cogs;
  }
  return Object.values(buckets)
    .sort((a, b) => (a.key < b.key ? -1 : 1))
    .map((b) => ({
      label: bucketLabel(b.key, groupBy),
      revenue: Math.round(b.revenue * 100) / 100,
      grossProfit: Math.round((b.revenue - b.cogs) * 100) / 100,
      marginPct: b.revenue > 0 ? Math.round(((b.revenue - b.cogs) / b.revenue) * 1000) / 10 : 0,
    }));
}
