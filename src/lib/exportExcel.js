import * as XLSX from "xlsx";
import { finishedGoodsInventory, materialLedger, salesWithMargin, productionRunCosts } from "./calc";

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
  })));

  addSheet(wb, "Product recipes", data.products.flatMap((p) =>
    p.ingredients.map((i) => ({
      Product: `${p.name} (${p.packSize})`, Ingredient: i.itemName,
      "Qty per unit": i.quantityPerUnit, Unit: i.unit,
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
      Quantity: o.quantity,
    }))
  ));

  addSheet(wb, "Production overheads", data.productionRuns.flatMap((run) =>
    (run.overheadCosts || []).map((o) => ({ "Batch code": run.batchCode, Date: run.date, Category: o.category, Cost: o.cost }))
  ));

  const inv = finishedGoodsInventory(data);
  addSheet(wb, "Inventory - finished goods", inv.map((r) => ({
    Product: `${r.product.name} (${r.product.flavor}, ${r.product.packSize})`,
    Produced: r.producedQty, Sold: r.soldQty, Spoiled: r.spoiledQty, "On hand": r.qtyOnHand,
    "Avg cost / unit": r.avgCostPerUnit.toFixed(2), "Value on hand": r.valueOnHand.toFixed(2),
  })));

  addSheet(wb, "Customers", data.customers.map((c) => ({
    ID: c.id, Name: c.name, Gender: c.gender, Profession: c.profession, Segment: c.segment, "Created at": c.createdAt,
  })));

  const salesLines = salesWithMargin(data);
  addSheet(wb, "Sales", salesLines.map((s) => ({
    Date: s.date, Order: s.orderId, Customer: s.customer?.name || "",
    Product: s.product ? `${s.product.name} (${s.product.packSize})` : "",
    Quantity: s.quantity, "Unit price": s.unitPrice, "Cost / unit": s.costPerUnit.toFixed(2),
    Revenue: s.revenue.toFixed(2), Margin: s.margin.toFixed(2), "Payment mode": s.paymentMode,
  })));

  addSheet(wb, "Spoilage", (data.spoilage || []).map((s) => ({
    Date: s.date, Product: productById[s.productId] ? `${productById[s.productId].name} (${productById[s.productId].packSize})` : s.productId,
    Quantity: s.quantity, Reason: s.reason,
  })));

  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `fabrica-export-${stamp}.xlsx`);
}

function addSheet(wb, name, rows) {
  const sheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{ "No data": "" }]);
  XLSX.utils.book_append_sheet(wb, sheet, name.slice(0, 31));
}
