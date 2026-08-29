// Non-destructive migration: adds fields introduced by later versions to
// data that was saved by an earlier version, WITHOUT altering or resetting
// any existing value. Runs once on load. Never bump the localStorage key
// in AppContext for a schema change if live data already exists — migrate
// it here instead, the same way this file does.

const DEFAULT_WHOLESALE_SUBCATEGORIES = ["Supermarket", "Distributor", "Grocery store", "Pharmacy"];

export function migrateData(raw) {
  if (!raw) return raw;
  let changed = false;
  const d = { ...raw };

  if (!d.segments) { d.segments = ["Retail", "Wholesale"]; changed = true; }
  if (!d.wholesaleSubCategories) { d.wholesaleSubCategories = DEFAULT_WHOLESALE_SUBCATEGORIES; changed = true; }

  const migratedCustomers = (d.customers || []).map((c) => {
    const patch = {};
    if (c.subCategory === undefined) patch.subCategory = "";
    if (c.state === undefined) patch.state = "";
    if (c.city === undefined) patch.city = "";
    if (c.email === undefined) patch.email = "";
    if (c.phone === undefined) patch.phone = "";
    if (c.customPrices === undefined) patch.customPrices = {};
    if (Object.keys(patch).length === 0) return c;
    changed = true;
    return { ...c, ...patch };
  });
  d.customers = migratedCustomers;

  const migratedProducts = (d.products || []).map((p) => {
    if (p.pricesBySegment) return p;
    changed = true;
    return { ...p, pricesBySegment: {} };
  });
  d.products = migratedProducts;

  // Existing orders had no amountPaid field, which would otherwise make
  // every historical order look like an outstanding receivable. Default
  // them to "fully paid" (amountPaid = order total) so nothing live
  // suddenly shows a balance that was never actually owed.
  const migratedOrders = (d.salesOrders || []).map((o) => {
    if (o.amountPaid !== undefined) return o;
    changed = true;
    const total = (o.items || []).reduce((s, i) => s + i.quantity * i.unitPrice, 0);
    return { ...o, amountPaid: total };
  });
  d.salesOrders = migratedOrders;

  const migratedSpoilage = (d.spoilage || []).map((s) => {
    if (s.kind) return s;
    changed = true;
    return { ...s, kind: "product" };
  });
  d.spoilage = migratedSpoilage;

  const migratedRuns = (d.productionRuns || []).map((run) => {
    // outputs may now carry an optional countedQuantity — no backfill
    // needed, absence is a valid "not counted yet" state, but normalize
    // to avoid `undefined` vs missing-key surprises in exports/UI.
    return run;
  });
  d.productionRuns = migratedRuns;

  return changed ? d : raw;
}
