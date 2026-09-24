// The double-entry ledger — the piece underneath the Financials module.
//
// Every other module in Fabrica (Sales, Supply, Production, Inventory)
// already computes revenue, COGS, receivables, payables, and inventory
// value live from source records — that's unaffected by any of this.
// What Fabrica never had anywhere is Cash & Bank, Fixed Assets, or
// Owner's Equity, so this ledger exists to give those a home, and to
// give the Balance Sheet a mechanically-guaranteed check: if the debits
// posted here don't equal the credits, something is wrong, immediately —
// not discovered months later.
//
// This mirrors the `chart_of_accounts` table in Postgres — keep the two
// in sync if either changes.
export const CHART_OF_ACCOUNTS = [
  { code: "1000", name: "Cash & Bank", type: "asset", normalBalance: "debit" },
  { code: "1100", name: "Accounts Receivable", type: "asset", normalBalance: "debit" },
  { code: "1200", name: "Inventory — Raw Materials", type: "asset", normalBalance: "debit" },
  { code: "1210", name: "Inventory — Finished Goods", type: "asset", normalBalance: "debit" },
  { code: "1300", name: "Fixed Assets, at cost", type: "asset", normalBalance: "debit" },
  { code: "1310", name: "Accumulated Depreciation", type: "asset", normalBalance: "credit" },
  { code: "2000", name: "Accounts Payable", type: "liability", normalBalance: "credit" },
  { code: "2100", name: "VAT Payable", type: "liability", normalBalance: "credit" },
  { code: "2200", name: "Accrued Expenses", type: "liability", normalBalance: "credit" },
  { code: "3000", name: "Owner's Capital", type: "equity", normalBalance: "credit" },
  { code: "3100", name: "Owner's Drawings", type: "equity", normalBalance: "debit" },
  { code: "4000", name: "Sales Revenue", type: "revenue", normalBalance: "credit" },
  { code: "5000", name: "Cost of Goods Sold", type: "cogs", normalBalance: "debit" },
  { code: "6000", name: "Operating Expenses", type: "expense", normalBalance: "debit" },
  { code: "6200", name: "Depreciation Expense", type: "expense", normalBalance: "debit" },
  { code: "6300", name: "Marketing / CSR — Product Giveaways", type: "expense", normalBalance: "debit" },
  { code: "6400", name: "Production Loss", type: "expense", normalBalance: "debit" },
  { code: "6500", name: "Spoilage", type: "expense", normalBalance: "debit" },
];

export const ACCOUNTS = Object.fromEntries(CHART_OF_ACCOUNTS.map((a) => [a.code, a]));

const round2 = (n) => Math.round((n || 0) * 100) / 100;

// Builds a balanced set of lines from a shorthand { code: amount } map for
// debits and another for credits, dropping any zero/near-zero lines (a
// giveaway-only sale, say, has no cash or COGS lines to post). Throws in
// dev if debits and credits don't match — a real bug, not a rounding
// nicety, so it should never pass silently.
function lines(debits, credits) {
  const out = [];
  for (const [code, amount] of Object.entries(debits)) {
    if (Math.abs(amount) > 0.004) out.push({ accountCode: code, debit: round2(amount), credit: 0 });
  }
  for (const [code, amount] of Object.entries(credits)) {
    if (Math.abs(amount) > 0.004) out.push({ accountCode: code, debit: 0, credit: round2(amount) });
  }
  const totalDebit = out.reduce((s, l) => s + l.debit, 0);
  const totalCredit = out.reduce((s, l) => s + l.credit, 0);
  if (Math.abs(totalDebit - totalCredit) > 0.02) {
    console.error("Fabrica ledger: unbalanced entry", { debits, credits, totalDebit, totalCredit });
  }
  return out;
}

// Posts a journal entry via the same add() every other module uses —
// failures surface through the existing error banner, and a failed post
// never blocks the primary record (the sale/delivery/etc.) that already
// saved successfully. Financial reporting being briefly out of sync is
// recoverable; losing the underlying business record is not.
export async function postJournalEntry(add, { date, memo, sourceType, sourceId, debits, credits }) {
  const entryLines = lines(debits, credits);
  if (entryLines.length === 0) return { ok: true, skipped: true };
  return add("journalEntries", { date, memo, sourceType, sourceId, lines: entryLines });
}

// --- Entry builders — one per kind of transaction that touches money ---

// A sale: cash/bank in for what was actually received, the rest to
// receivable; revenue and VAT payable for the billable amount; COGS for
// what was sold, split so a giveaway's cost lands in the CSR/marketing
// expense line instead of COGS (it was never actually sold).
export function journalForSale(order, { subtotal, vatAmount, cashReceived, receivableDelta, cogsSold, cogsGiveaway }) {
  return {
    date: order.date,
    memo: `Sale${order.invoiceNumber ? ` ${order.invoiceNumber}` : ""}`,
    sourceType: "sale",
    sourceId: order.id,
    debits: {
      "1000": cashReceived,
      "1100": receivableDelta,
      "5000": cogsSold,
      "6300": cogsGiveaway,
    },
    credits: {
      "4000": subtotal,
      "2100": vatAmount,
      "1210": cogsSold + cogsGiveaway,
    },
  };
}

// A later payment collected against an already-saved order's balance —
// "Credit" postpones the sale's own receivable but doesn't move cash, so
// it's not posted here; a real payment (Cash/POS/Transfer) moves cash in
// and shrinks that same receivable.
export function journalForPaymentReceived(order, amount) {
  return {
    date: new Date().toISOString().slice(0, 10),
    memo: `Payment received${order.invoiceNumber ? ` — ${order.invoiceNumber}` : ""}`,
    sourceType: "sale",
    sourceId: order.id,
    debits: { "1000": amount },
    credits: { "1100": amount },
  };
}

// A delivery from a supplier: raw materials in, cash out for what was
// actually paid now, the rest to payable.
export function journalForSupply(batch) {
  const paid = batch.amountPaid || 0;
  const payable = Math.max(0, batch.totalCost - paid);
  return {
    date: batch.dateReceived,
    memo: `Delivery — ${batch.itemName}`,
    sourceType: "supply",
    sourceId: batch.id,
    debits: { "1200": batch.totalCost },
    credits: { "1000": paid, "2000": payable },
  };
}

// A production output line, posted the moment its physical count is
// locked in (that's the point a quantity — good or lost — actually
// becomes real). Raw materials consumed move out; finished goods for
// good units move in at allocated cost; lost units expense out instead
// of becoming inventory; labor and overhead for this line's share paid
// from cash (assumed paid at the time — a real accrual can be added
// later if you carry unpaid staff wages or utility bills).
export function journalForProductionCount(run, output, { materialConsumed, laborShare, overheadShare, finishedGoodsIn, lossValue }) {
  return {
    date: run.date,
    memo: `Production ${run.batchCode} — physical count`,
    sourceType: "production",
    sourceId: run.id,
    debits: {
      "1210": finishedGoodsIn,
      "6400": lossValue,
    },
    credits: {
      "1200": materialConsumed,
      "1000": laborShare + overheadShare,
    },
  };
}

// A write-off of already-counted stock (spoilage) — value simply leaves
// inventory and becomes an expense; no cash movement.
export function journalForSpoilage(entry) {
  const inventoryAccount = entry.kind === "material" ? "1200" : "1210";
  return {
    date: entry.date,
    memo: `Spoilage — ${entry.kind === "material" ? entry.itemName : "finished product"}`,
    sourceType: "spoilage",
    sourceId: entry.id,
    debits: { "6500": entry.valueLost || 0 },
    credits: { [inventoryAccount]: entry.valueLost || 0 },
  };
}

// An operating expense — paid now from cash/bank, or left as accrued if
// not fully paid.
export function journalForExpense(expense) {
  const paid = expense.amountPaid || 0;
  const accrued = Math.max(0, expense.amount - paid);
  return {
    date: expense.date,
    memo: `${expense.category}${expense.description ? ` — ${expense.description}` : ""}`,
    sourceType: "expense",
    sourceId: expense.id,
    debits: { "6000": expense.amount },
    credits: { "1000": paid, "2200": accrued },
  };
}

// A fixed asset purchase — assumed paid in full at purchase.
export function journalForFixedAsset(asset) {
  return {
    date: asset.purchaseDate,
    memo: `Fixed asset — ${asset.name}`,
    sourceType: "fixed_asset",
    sourceId: asset.id,
    debits: { "1300": asset.cost },
    credits: { "1000": asset.cost },
  };
}

// Owner's capital contribution or drawing.
export function journalForEquity(tx) {
  const isContribution = tx.type === "contribution";
  return {
    date: tx.date,
    memo: isContribution ? "Owner's capital contribution" : "Owner's drawing",
    sourceType: "equity",
    sourceId: tx.id,
    debits: isContribution ? { "1000": tx.amount } : { "3100": tx.amount },
    credits: isContribution ? { "3000": tx.amount } : { "1000": tx.amount },
  };
}
