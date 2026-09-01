import * as XLSX from "xlsx";
import { finishedGoodsInventory, materialLedger, salesWithMargin, productionRunCosts, estimateIngredientAllocation, orderPaidTotal, orderPayments, summarizePaymentModes } from "./calc";

export function exportAllToExcel(data) {
  const wb = XLSX.utils.book_new();
  const supplierById = Object.fromEntries(data.suppliers.map((s) => [s.id, s.name]));
  const productById = Object.fromEntries(data.products.map((p) => [p.id, p]));

  addSheet(wb, "Suppliers", data.suppliers.map((s) => ({
    ID: s.id, Name: s.name, Contact: s.contact,
  })));

  addSheet(wb, "Supply deliveries", data.supplyBatches.map((b) => ({
    Date: b.dateReceived, Supplier: supplierById[b.supplierId] || "", Item: b.itemName,
    Quantity: b.quantity, Unit: b.unit, "Unit cost": b.unitCost, "Total cost": b.totalCost,
    "Amount paid": b.amountPaid, Notes: b.notes,
  })));

  addSheet(wb, "Products", data.products.map((p) => ({
    ID: p.id, Name: p.name, Flavor: p.flavor, "Pack size": p.packSize,
    ...Object.fromEntries(Object.entries(p.pricesBySegment || {}).map(([seg, price]) => [`${seg} price`, price])),
  })));

  addSheet(wb, "Product recipes", data.products.flatMap((p) =>
    p.ingredients.map((i) => ({
      Product: `${p.name} (${p.packSize})`, Ingredient: i.itemName,
    }))
  ));

  const ledger = materialLedger(data);
  addSheet(wb, "Materials ledger", ledger.map((r) => ({
    Material: r.itemName, "Supplied (base)": r.suppliedBase.toFixed(2), "Consumed (base)": r.consumedBase.toFixed(2),
    "Remaining (base)": r.remainingBase.toFixed(2), "Base unit": r.baseUnit,
    "Avg cost / base unit": r.avgUnitCostBase.toFixed(4), "Value remaining": r.valueRemaining.toFixed(2),
    Payable: r.payable.toFixed(2),
  })));

  addSheet(wb, "Production runs", data.productionRuns.map((run) => {
    const { totalRunCost, materialCost, overheadTotal } = productionRunCosts(run, ledger, productById);
    return {
      "Batch code": run.batchCode, Date: run.date, "Material cost": materialCost.toFixed(2),
      "Labor cost": run.laborCost, "Overhead total": overheadTotal.toFixed(2), "Total cost": totalRunCost.toFixed(2),
      Notes: run.notes,
    };
  }));

  addSheet(wb, "Production inputs", data.productionRuns.flatMap((run) =>
    run.inputs.map((i) => ({ "Batch code": run.batchCode, Date: run.date, Material: i.itemName, Quantity: i.quantity, Unit: i.unit }))
  ));

  addSheet(wb, "Production outputs", data.productionRuns.flatMap((run) =>
    run.outputs.map((o) => ({
      "Batch code": run.batchCode, Date: run.date,
      Product: productById[o.productId] ? `${productById[o.productId].name} (${productById[o.productId].packSize})` : o.productId,
      "Physical count": o.countedQuantity ?? (o.quantity !== undefined ? o.quantity : "pending"),
      Source: o.countedQuantity !== undefined ? "counted" : (o.quantity !== undefined ? "logged (legacy)" : "pending count"),
    }))
  ));

  addSheet(wb, "Production overheads", data.productionRuns.flatMap((run) =>
    (run.overheadCosts || []).map((o) => ({ "Batch code": run.batchCode, Date: run.date, Category: o.category, Cost: o.cost }))
  ));

  addSheet(wb, "Est. ingredient use per product", data.productionRuns.flatMap((run) => {
    const allocation = estimateIngredientAllocation(run, productById);
    return Object.entries(allocation).flatMap(([itemName, rows]) =>
      rows.map((r) => ({
        "Batch code": run.batchCode, Date: run.date, Material: itemName,
        Product: r.product ? `${r.product.name} (${r.product.packSize})` : "",
        "Estimated quantity": r.quantity.toFixed(3), Unit: r.unit,
      }))
    );
  }));

  const inv = finishedGoodsInventory(data);
  addSheet(wb, "Inventory - finished goods", inv.map((r) => ({
    Product: `${r.product.name} (${r.product.flavor}, ${r.product.packSize})`,
    Produced: r.producedQty, Sold: r.soldQty, Spoiled: r.spoiledQty, "On hand": r.qtyOnHand,
    "Avg cost / unit": r.avgCostPerUnit.toFixed(2), "Value on hand": r.valueOnHand.toFixed(2),
  })));

  addSheet(wb, "Customers", data.customers.map((c) => ({
    ID: c.id, Name: c.name, Segment: c.segment, "Wholesale category": c.subCategory || "",
    Gender: c.gender || "", Profession: c.profession || "",
    State: c.state || "", City: c.city || "", Email: c.email || "", Phone: c.phone || "",
    "Created at": c.createdAt,
  })));

  addSheet(wb, "Customer custom prices", data.customers.flatMap((c) =>
    Object.entries(c.customPrices || {}).map(([productId, price]) => ({
      Customer: c.name, Product: productById[productId] ? `${productById[productId].name} (${productById[productId].packSize})` : productId,
      Price: price,
    }))
  ));

  const salesLines = salesWithMargin(data);
  addSheet(wb, "Sales (line items)", salesLines.map((s) => ({
    Date: s.date, Order: s.orderId, Customer: s.customer?.name || "",
    Product: s.product ? `${s.product.name} (${s.product.packSize})` : "",
    Quantity: s.quantity, "Unit price": s.unitPrice, "Cost / unit": s.costPerUnit.toFixed(2),
    Revenue: s.revenue.toFixed(2), Margin: s.margin.toFixed(2), "Payment mode": s.paymentMode,
  })));

  const customerById = Object.fromEntries(data.customers.map((c) => [c.id, c]));
  addSheet(wb, "Sales orders", data.salesOrders.map((o) => {
    const total = (o.items || []).reduce((s, i) => s + i.quantity * i.unitPrice, 0);
    const paid = orderPaidTotal(o, total);
    return {
      Order: o.id, Date: o.date, Customer: customerById[o.customerId]?.name || "",
      "Payment mode(s)": summarizePaymentModes(orderPayments(o, total)), "Order total": total.toFixed(2), "Amount paid": paid.toFixed(2),
      Balance: Math.max(0, total - paid).toFixed(2),
    };
  }));

  addSheet(wb, "Payments", data.salesOrders.flatMap((o) => {
    const total = (o.items || []).reduce((s, i) => s + i.quantity * i.unitPrice, 0);
    return orderPayments(o, total).map((p) => ({
      Order: o.id, Customer: customerById[o.customerId]?.name || "",
      Date: p.date || o.date, Amount: (p.amount || 0).toFixed(2), Mode: p.mode || "",
    }));
  }));

  addSheet(wb, "Spoilage", (data.spoilage || []).map((s) => ({
    Date: s.date, Kind: s.kind,
    Item: s.kind === "product"
      ? (productById[s.productId] ? `${productById[s.productId].name} (${productById[s.productId].packSize})` : s.productId)
      : s.itemName,
    Quantity: s.quantity, Unit: s.kind === "material" ? s.unit : "unit",
    Reason: s.reason || "", "Value lost": (s.valueLost || 0).toFixed(2),
  })));

  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `fabrica-export-${stamp}.xlsx`);
}

function addSheet(wb, name, rows) {
  const sheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{ "No data": "" }]);
  XLSX.utils.book_append_sheet(wb, sheet, name.slice(0, 31));
}
