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
    return { ...o, product, quantity: qty, isCounted: o.countedQuantity !== undefined, weightShare: packWeight * qty };
  });
  const totalWeight = outputsWithWeight.reduce((s, o) => s + o.weightShare, 0) || 1;

  return {
    materialCost,
    overheadTotal,
    totalRunCost,
    outputs: outputsWithWeight.map((o) => ({
      ...o,
      costAllocated: totalRunCost * (o.weightShare / totalWeight),
      costPerUnit: (totalRunCost * (o.weightShare / totalWeight)) / (o.quantity || 1),
    })),
  };
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
    for (const item of order.items || []) {
      sold[item.productId] = (sold[item.productId] || 0) + item.quantity;
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
    for (const item of order.items || []) {
      const costPerUnit = costByProduct[item.productId] || 0;
      const revenue = item.quantity * item.unitPrice;
      const cogs = item.quantity * costPerUnit;
      rows.push({
        id: `${order.id}::${item.productId}`,
        orderId: order.id,
        date: order.date,
        paymentMode: order.paymentMode,
        customer: customerById[order.customerId],
        customerId: order.customerId,
        product: productById[item.productId],
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        costPerUnit,
        revenue,
        cogs,
        margin: revenue - cogs,
        marginPct: revenue > 0 ? ((revenue - cogs) / revenue) * 100 : 0,
      });
    }
  }
  return rows;
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
    const total = (order.items || []).reduce((s, i) => s + i.quantity * i.unitPrice, 0);
    const paid = order.amountPaid ?? total;
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

export function overviewMetrics(data, range = {}) {
  const { from, to } = range;
  const lines = salesWithMargin(data).filter((s) => inRange(s.date, from, to));
  const ledger = materialLedger(data);
  const inv = finishedGoodsInventory(data);

  const totalRevenue = lines.reduce((s, r) => s + r.revenue, 0);
  const totalCogs = lines.reduce((s, r) => s + r.cogs, 0);
  const grossProfit = totalRevenue - totalCogs;
  const grossMarginPct = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
  const activeCustomers = new Set(lines.map((s) => s.customerId)).size;
  const inventoryValue = inv.reduce((s, r) => s + r.valueOnHand, 0) + ledger.reduce((s, r) => s + r.valueRemaining, 0);
  const payables = ledger.reduce((s, r) => s + r.payable, 0);
  const receivables = data.salesOrders.reduce((s, order) => {
    const total = (order.items || []).reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
    const paid = order.amountPaid ?? total;
    return s + Math.max(0, total - paid);
  }, 0);
  const unitsSold = lines.reduce((s, r) => s + r.quantity, 0);
  const orderCount = new Set(lines.map((r) => r.orderId)).size;

  return {
    totalRevenue,
    totalCogs,
    grossProfit,
    grossMarginPct,
    activeCustomers,
    inventoryValue,
    payables,
    receivables,
    unitsSold,
    orderCount,
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
