// Unit of measure conversion. Every unit belongs to a category and converts
// to a base unit within that category. Factors are "how many base units in 1 of this unit".
export const DEFAULT_UNITS = {
  weight: {
    base: "g",
    factors: { g: 1, kg: 1000, mg: 0.001, lb: 453.592, oz: 28.3495, ton: 1000000 },
  },
  volume: {
    base: "ml",
    factors: { ml: 1, l: 1000, tsp: 4.92892, tbsp: 14.7868, cup: 236.588, gal: 3785.41 },
  },
  count: {
    base: "unit",
    factors: { unit: 1, dozen: 12, pack: 1, carton: 1, bag: 1, bottle: 1 },
  },
};

export function unitCategory(unit, custom = {}) {
  const all = mergeUnits(custom);
  for (const [cat, def] of Object.entries(all)) {
    if (unit in def.factors) return cat;
  }
  return null;
}

export function mergeUnits(custom = {}) {
  const merged = JSON.parse(JSON.stringify(DEFAULT_UNITS));
  for (const [cat, def] of Object.entries(custom)) {
    if (!merged[cat]) merged[cat] = { base: def.base, factors: {} };
    merged[cat].factors = { ...merged[cat].factors, ...def.factors };
  }
  return merged;
}

// Convert a quantity from one unit to another. Returns null if units are
// in different categories (can't convert kg to litres).
export function convert(qty, fromUnit, toUnit, custom = {}) {
  const all = mergeUnits(custom);
  const fromCat = unitCategory(fromUnit, custom);
  const toCat = unitCategory(toUnit, custom);
  if (!fromCat || !toCat || fromCat !== toCat) return null;
  const { factors } = all[fromCat];
  const baseQty = qty * factors[fromUnit];
  return baseQty / factors[toUnit];
}

export function toBase(qty, unit, custom = {}) {
  const all = mergeUnits(custom);
  const cat = unitCategory(unit, custom);
  if (!cat) return qty;
  return qty * all[cat].factors[unit];
}

export function baseUnitOf(unit, custom = {}) {
  const all = mergeUnits(custom);
  const cat = unitCategory(unit, custom);
  return cat ? all[cat].base : unit;
}

export function allUnits(custom = {}) {
  const all = mergeUnits(custom);
  return Object.entries(all).flatMap(([cat, def]) =>
    Object.keys(def.factors).map((u) => ({ unit: u, category: cat }))
  );
}

// Formats a base-unit quantity (grams, millilitres) into whatever unit
// reads naturally at that scale — kilograms once a weight crosses into
// the thousands of grams, litres once a volume does the same. The
// internal base-unit conversion is still what makes the math correct
// across mixed units; this only changes what gets displayed.
function scaleForDisplay(baseAmount, baseUnit) {
  if (baseUnit === "g" && Math.abs(baseAmount) >= 1000) return { unit: "kg", factor: 1000 };
  if (baseUnit === "ml" && Math.abs(baseAmount) >= 1000) return { unit: "l", factor: 1000 };
  return { unit: baseUnit, factor: 1 };
}

export function formatQuantity(baseAmount, baseUnit, decimals = 1) {
  const { unit, factor } = scaleForDisplay(baseAmount, baseUnit);
  return `${((baseAmount || 0) / factor).toFixed(decimals)}${unit}`;
}

// A cost-per-base-unit figure (e.g. cost per gram) is meaningless on its
// own next to a quantity shown in kg — ₦0.90 reads like ₦0.90/kg when
// it's actually ₦0.90/g, a 1000x misread. This rescales the cost to
// match whatever unit formatQuantity chose for the same underlying
// amount, so the two numbers shown side by side are always consistent
// with each other. Returns { amount, unit } — the caller applies its own
// currency formatting to `amount` and appends "/" + unit.
export function scaledUnitCost(costPerBaseUnit, referenceBaseAmount, baseUnit) {
  const { unit, factor } = scaleForDisplay(referenceBaseAmount, baseUnit);
  return { amount: (costPerBaseUnit || 0) * factor, unit };
}
