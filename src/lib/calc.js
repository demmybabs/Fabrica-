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

// Scale a product's recipe (quantity per one unit) up to the batch size
// being produced. Used to auto-fill the materials list on a production run.
export function scaleRecipe(product, outputQty) {
  if (!product?.ingredients) return [];
  return product.ingredients.map((ing) => ({
    itemName: ing.itemName,
    quantity: round4(ing.quantityPerUnit * outputQty),
    unit: ing.unit,
  }));
}

function round4(n) {
  return Math.round(n * 10000) / 10000;
}

// Combine scaled recipes from several output lines into one materials list,
// summing quantities where the same material is needed by more than one
// output product in the same run.
export function suggestInputsForOutputs(outputs, productById) {
  const byKey = {};
  for (const o of outputs) {
    const product = productById[o.productId];
    if (!product || !o.quantity) continue;
    for (const row of scaleRecipe(product, o.quantity)) {
      const key = `${row.itemName}::${row.unit}`;
      if (!byKey[key]) byKey[key] = { ...row };
      else byKey[key].quantity = round4(byKey[key].quantity + row.quantity);
    }
  }
  return Object.values(byKey);
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
    return { ...o, product, weightShare: packWeight * o.quantity };
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
    unitsSold,
    orderCount,
  };
}
