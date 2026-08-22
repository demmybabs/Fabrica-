// Seed data for Fabrica Foods — a granola & snack-bar production line.
// Everything here is example data the user replaces with their own.

const today = new Date();
const daysAgo = (n) => {
  const d = new Date(today);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

export const seedSuppliers = [
  { id: "sup_oats", name: "Northfield Grain Co.", contact: "orders@northfieldgrain.example" },
  { id: "sup_sweet", name: "Amber Apiary Honey", contact: "sales@amberapiary.example" },
  { id: "sup_pack", name: "Lagos Pack & Print", contact: "hello@lagospack.example" },
];

export const seedSupplyBatches = [
  { id: "spb_001", supplierId: "sup_oats", itemName: "Rolled oats", quantity: 400, unit: "kg", unitCost: 0.9, totalCost: 360, dateReceived: daysAgo(28), amountPaid: 360, notes: "" },
  { id: "spb_002", supplierId: "sup_oats", itemName: "Almonds", quantity: 60, unit: "kg", unitCost: 6.2, totalCost: 372, dateReceived: daysAgo(28), amountPaid: 200, notes: "Balance owed" },
  { id: "spb_003", supplierId: "sup_sweet", itemName: "Honey", quantity: 80, unit: "l", unitCost: 4.5, totalCost: 360, dateReceived: daysAgo(21), amountPaid: 360, notes: "" },
  { id: "spb_004", supplierId: "sup_sweet", itemName: "Dried cranberries", quantity: 30, unit: "kg", unitCost: 5.8, totalCost: 174, dateReceived: daysAgo(21), amountPaid: 174, notes: "" },
  { id: "spb_005", supplierId: "sup_oats", itemName: "Sunflower oil", quantity: 40, unit: "l", unitCost: 2.1, totalCost: 84, dateReceived: daysAgo(14), amountPaid: 84, notes: "" },
  { id: "spb_006", supplierId: "sup_pack", itemName: "Pouch — 500g", quantity: 2000, unit: "unit", unitCost: 0.08, totalCost: 160, dateReceived: daysAgo(14), amountPaid: 100, notes: "Balance owed" },
  { id: "spb_007", supplierId: "sup_pack", itemName: "Pouch — 1kg", quantity: 1000, unit: "unit", unitCost: 0.12, totalCost: 120, dateReceived: daysAgo(14), amountPaid: 120, notes: "" },
  { id: "spb_008", supplierId: "sup_oats", itemName: "Rolled oats", quantity: 200, unit: "kg", unitCost: 0.92, totalCost: 184, dateReceived: daysAgo(7), amountPaid: 0, notes: "Balance owed" },
];

export const seedSkus = [
  { id: "sku_classic_1kg", name: "Classic granola", flavor: "Classic", packSize: "1kg", unit: "unit" },
  { id: "sku_classic_500g", name: "Classic granola", flavor: "Classic", packSize: "500g", unit: "unit" },
  { id: "sku_berry_500g", name: "Berry crunch granola", flavor: "Berry crunch", packSize: "500g", unit: "unit" },
];

export const seedProductionRuns = [
  {
    id: "run_001",
    date: daysAgo(20),
    batchCode: "PRD-0001",
    inputs: [
      { itemName: "Rolled oats", quantity: 60, unit: "kg" },
      { itemName: "Honey", quantity: 8, unit: "l" },
      { itemName: "Sunflower oil", quantity: 4, unit: "l" },
      { itemName: "Almonds", quantity: 10, unit: "kg" },
    ],
    outputs: [
      { skuId: "sku_classic_1kg", quantity: 40, unit: "unit" },
      { skuId: "sku_classic_500g", quantity: 60, unit: "unit" },
    ],
    laborCost: 45,
    overheadCost: 20,
    notes: "Morning shift",
  },
  {
    id: "run_002",
    date: daysAgo(12),
    batchCode: "PRD-0002",
    inputs: [
      { itemName: "Rolled oats", quantity: 40, unit: "kg" },
      { itemName: "Honey", quantity: 6, unit: "l" },
      { itemName: "Dried cranberries", quantity: 12, unit: "kg" },
      { itemName: "Sunflower oil", quantity: 3, unit: "l" },
    ],
    outputs: [
      { skuId: "sku_berry_500g", quantity: 70, unit: "unit" },
    ],
    laborCost: 38,
    overheadCost: 15,
    notes: "Berry crunch flavour split from the classic line",
  },
  {
    id: "run_003",
    date: daysAgo(4),
    batchCode: "PRD-0003",
    inputs: [
      { itemName: "Rolled oats", quantity: 50, unit: "kg" },
      { itemName: "Honey", quantity: 7, unit: "l" },
      { itemName: "Almonds", quantity: 8, unit: "kg" },
      { itemName: "Sunflower oil", quantity: 3, unit: "l" },
    ],
    outputs: [
      { skuId: "sku_classic_1kg", quantity: 30, unit: "unit" },
      { skuId: "sku_classic_500g", quantity: 45, unit: "unit" },
    ],
    laborCost: 42,
    overheadCost: 18,
    notes: "",
  },
];

export const seedCustomers = [
  { id: "cus_001", name: "Amara Nwosu", gender: "Female", profession: "Fitness coach", segment: "Wholesale", phone: "", createdAt: daysAgo(25) },
  { id: "cus_002", name: "Chidi Obi", gender: "Male", profession: "Office worker", segment: "Retail", phone: "", createdAt: daysAgo(22) },
  { id: "cus_003", name: "Bola Adekunle", gender: "Female", profession: "Model", segment: "Retail", phone: "", createdAt: daysAgo(18) },
  { id: "cus_004", name: "Segun Bello", gender: "Male", profession: "Gym owner", segment: "Wholesale", phone: "", createdAt: daysAgo(15) },
  { id: "cus_005", name: "Ifeoma Chukwu", gender: "Female", profession: "Nutritionist", segment: "Retail", phone: "", createdAt: daysAgo(10) },
];

export const seedSales = [
  { id: "sal_001", date: daysAgo(19), customerId: "cus_001", skuId: "sku_classic_1kg", quantity: 10, unit: "unit", unitPrice: 9.5, paymentMode: "Transfer" },
  { id: "sal_002", date: daysAgo(17), customerId: "cus_002", skuId: "sku_classic_500g", quantity: 6, unit: "unit", unitPrice: 5.2, paymentMode: "Cash" },
  { id: "sal_003", date: daysAgo(11), customerId: "cus_003", skuId: "sku_berry_500g", quantity: 8, unit: "unit", unitPrice: 5.8, paymentMode: "POS" },
  { id: "sal_004", date: daysAgo(9), customerId: "cus_004", skuId: "sku_classic_1kg", quantity: 20, unit: "unit", unitPrice: 9.0, paymentMode: "Credit" },
  { id: "sal_005", date: daysAgo(6), customerId: "cus_005", skuId: "sku_berry_500g", quantity: 5, unit: "unit", unitPrice: 5.8, paymentMode: "Transfer" },
  { id: "sal_006", date: daysAgo(3), customerId: "cus_001", skuId: "sku_classic_500g", quantity: 12, unit: "unit", unitPrice: 5.2, paymentMode: "Transfer" },
];

export function buildSeed() {
  return {
    suppliers: seedSuppliers,
    supplyBatches: seedSupplyBatches,
    skus: seedSkus,
    productionRuns: seedProductionRuns,
    customers: seedCustomers,
    sales: seedSales,
    spoilage: [],
    customUnits: {},
  };
}
