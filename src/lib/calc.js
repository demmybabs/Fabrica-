import { toBase, baseUnitOf, convert } from "./uom";

// Parse a pack size string like "500g", "1kg", "250ml" into grams (or ml)
// as a plain number, so we can weight cost allocation across differently
// sized SKUs from the same production run.
export function parsePackSize(packSize) {
  const match = String(packSize).match(/([\d.]+)\s*([a-zA-Z]+)/);
  if (!match) return 1;
  const [, num, unit] = match;
  const base = toBase(parseFloat(num), unit.toLowerCase());
  return base || parseFloat(num);
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

  return Object.values(byItem).map((row) => {
    const avgUnitCostBase = row.suppliedBase > 0 ? row.costSupplied / row.suppliedBase : 0;
    const remainingBase = row.suppliedBase - row.consumedBase;
    return {
      ...row,
      avgUnitCostBase,
      remainingBase,
      remainingDisplay: convert(remainingBase, row.baseUnit, row.displayUnit, customUnits) ?? remainingBase,
      valueRemaining: remainingBase * avgUnitCostBase,
      payable: row.costSupplied - row.paid,
    };
  });
}

// Cost of a single production run, allocated across its output SKUs by
// weight share (a 1kg pack absorbs ~2x the cost of a 500g pack from the
// same batch) rather than split evenly per unit.
export function productionRunCosts(run, ledger, skuById) {
  const ledgerByItem = Object.fromEntries(ledger.map((r) => [r.itemName, r]));
  const materialCost = run.inputs.reduce((sum, input) => {
    const row = ledgerByItem[input.itemName];
    const qtyBase = toBase(input.quantity, input.unit);
    return sum + qtyBase * (row?.avgUnitCostBase || 0);
  }, 0);
  const totalRunCost = materialCost + (run.laborCost || 0) + (run.overheadCost || 0);

  const outputsWithWeight = run.outputs.map((o) => {
    const sku = skuById[o.skuId];
    const packWeight = parsePackSize(sku?.packSize || "1unit");
    return { ...o, sku, weightShare: packWeight * o.quantity };
  });
  const totalWeight = outputsWithWeight.reduce((s, o) => s + o.weightShare, 0) || 1;

  return {
    materialCost,
    totalRunCost,
    outputs: outputsWithWeight.map((o) => ({
      ...o,
      costAllocated: totalRunCost * (o.weightShare / totalWeight),
      costPerUnit: (totalRunCost * (o.weightShare / totalWeight)) / (o.quantity || 1),
    })),
  };
}

// Finished-goods inventory: quantity on hand and weighted-average cost per
// unit for every SKU, built from every production run that made it, minus
// what's been sold or marked as spoiled.
export function finishedGoodsInventory(data) {
  const { skus, productionRuns, sales, spoilage } = data;
  const ledger = materialLedger(data);
  const skuById = Object.fromEntries(skus.map((s) => [s.id, s]));

  const produced = {};
  for (const run of productionRuns) {
    const { outputs } = productionRunCosts(run, ledger, skuById);
    for (const o of outputs) {
      if (!produced[o.skuId]) produced[o.skuId] = { qty: 0, cost: 0 };
      produced[o.skuId].qty += o.quantity;
      produced[o.skuId].cost += o.costAllocated;
    }
  }

  const sold = {};
  for (const s of sales) {
    sold[s.skuId] = (sold[s.skuId] || 0) + s.quantity;
  }
  const spoiled = {};
  for (const s of spoilage || []) {
    spoiled[s.skuId] = (spoiled[s.skuId] || 0) + s.quantity;
  }

  return skus.map((sku) => {
    const p = produced[sku.id] || { qty: 0, cost: 0 };
    const avgCostPerUnit = p.qty > 0 ? p.cost / p.qty : 0;
    const qtyOnHand = p.qty - (sold[sku.id] || 0) - (spoiled[sku.id] || 0);
    return {
      sku,
      producedQty: p.qty,
      soldQty: sold[sku.id] || 0,
      spoiledQty: spoiled[sku.id] || 0,
      qtyOnHand,
      avgCostPerUnit,
      valueOnHand: qtyOnHand * avgCostPerUnit,
    };
  });
}

// Sales enriched with cost-of-goods and margin, using each SKU's current
// weighted-average production cost.
export function salesWithMargin(data) {
  const inv = finishedGoodsInventory(data);
  const costBySku = Object.fromEntries(inv.map((r) => [r.sku.id, r.avgCostPerUnit]));
  const customerById = Object.fromEntries(data.customers.map((c) => [c.id, c]));
  const skuById = Object.fromEntries(data.skus.map((s) => [s.id, s]));
  return data.sales.map((s) => {
    const costPerUnit = costBySku[s.skuId] || 0;
    const revenue = s.quantity * s.unitPrice;
    const cogs = s.quantity * costPerUnit;
    return {
      ...s,
      sku: skuById[s.skuId],
      customer: customerById[s.customerId],
      costPerUnit,
      revenue,
      cogs,
      margin: revenue - cogs,
      marginPct: revenue > 0 ? ((revenue - cogs) / revenue) * 100 : 0,
    };
  });
}

export function customerAnalytics(data) {
  const sales = salesWithMargin(data);
  const byCustomer = {};
  for (const s of sales) {
    if (!s.customer) continue;
    const id = s.customer.id;
    if (!byCustomer[id]) {
      byCustomer[id] = { customer: s.customer, orders: 0, revenue: 0, margin: 0, lastDate: s.date };
    }
    byCustomer[id].orders += 1;
    byCustomer[id].revenue += s.revenue;
    byCustomer[id].margin += s.margin;
    if (s.date > byCustomer[id].lastDate) byCustomer[id].lastDate = s.date;
  }
  return data.customers.map((c) => byCustomer[c.id] || { customer: c, orders: 0, revenue: 0, margin: 0, lastDate: null });
}

export function inRange(dateStr, from, to) {
  if (!dateStr) return false;
  if (from && dateStr < from) return false;
  if (to && dateStr > to) return false;
  return true;
}

export function overviewMetrics(data, range = {}) {
  const { from, to } = range;
  const sales = salesWithMargin(data).filter((s) => inRange(s.date, from, to));
  const ledger = materialLedger(data);
  const inv = finishedGoodsInventory(data);

  const totalRevenue = sales.reduce((s, r) => s + r.revenue, 0);
  const totalCogs = sales.reduce((s, r) => s + r.cogs, 0);
  const grossProfit = totalRevenue - totalCogs;
  const grossMarginPct = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
  const activeCustomers = new Set(sales.map((s) => s.customerId)).size;
  const inventoryValue = inv.reduce((s, r) => s + r.valueOnHand, 0) + ledger.reduce((s, r) => s + r.valueRemaining, 0);
  const payables = ledger.reduce((s, r) => s + r.payable, 0);
  const unitsSold = sales.reduce((s, r) => s + r.quantity, 0);

  return {
    totalRevenue,
    totalCogs,
    grossProfit,
    grossMarginPct,
    activeCustomers,
    inventoryValue,
    payables,
    unitsSold,
    orderCount: sales.length,
  };
}
