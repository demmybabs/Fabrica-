// Statement calculators for the Financials module — Income Statement,
// Balance Sheet, and Cash Flow Statement, built for a selected period.
//
// Revenue, COGS, receivables, payables, and inventory value are computed
// live from source records (sales orders, supply batches, production
// runs, spoilage) exactly like the rest of Fabrica always has — so they
// reflect FULL history, with no gap.
//
// Cash & Bank, VAT/accrued liabilities, Owner's Capital/Drawings, and
// Retained Earnings are computed from the double-entry ledger
// (journal_entries), which only started posting the day this feature
// went live — see CHART_OF_ACCOUNTS in ledger.js. A statement whose
// period starts before that day will still be complete for revenue,
// COGS, receivables, payables and inventory, but Cash & Bank and
// Owner's Equity reflect only activity from go-live forward.
import { CHART_OF_ACCOUNTS } from "./ledger";
import {
  materialLedger,
  finishedGoodsInventory,
  salesWithMargin,
  productionLosses,
  orderPaidTotal,
  inRange,
} from "./calc";

const ACCOUNTS_BY_CODE = Object.fromEntries(CHART_OF_ACCOUNTS.map((a) => [a.code, a]));

const keepOnOrBefore = (dateStr, asOf) => !asOf || (dateStr && dateStr <= asOf);

// Restricts every date-stamped collection to records on or before `asOf`,
// so "as of a date in the past" statements don't include things that
// hadn't happened yet. Passing no asOf (or today) is effectively "all of
// it, as things stand right now".
function dataAsOf(data, asOf) {
  if (!asOf) return data;
  return {
    ...data,
    supplyBatches: (data.supplyBatches || []).filter((b) => keepOnOrBefore(b.dateReceived, asOf)),
    productionRuns: (data.productionRuns || []).filter((r) => keepOnOrBefore(r.date, asOf)),
    salesOrders: (data.salesOrders || []).filter((o) => keepOnOrBefore(o.date, asOf)),
    spoilage: (data.spoilage || []).filter((s) => keepOnOrBefore(s.date, asOf)),
    journalEntries: (data.journalEntries || []).filter((j) => keepOnOrBefore(j.date, asOf)),
    operatingExpenses: (data.operatingExpenses || []).filter((e) => keepOnOrBefore(e.date, asOf)),
    fixedAssets: (data.fixedAssets || []).filter((a) => keepOnOrBefore(a.purchaseDate, asOf)),
    equityTransactions: (data.equityTransactions || []).filter((t) => keepOnOrBefore(t.date, asOf)),
  };
}

// Net balance of every ledger account, as of a date, in "normal balance"
// terms — positive means a debit-normal account (asset/expense) has a
// debit balance, or a credit-normal account (liability/equity/revenue)
// has a credit balance, which is the sign a reader expects.
function ledgerBalancesAsOf(journalEntries, asOf) {
  const raw = Object.fromEntries(CHART_OF_ACCOUNTS.map((a) => [a.code, 0]));
  for (const entry of journalEntries) {
    if (asOf && entry.date > asOf) continue;
    for (const line of entry.lines || []) {
      if (!(line.accountCode in raw)) continue;
      raw[line.accountCode] += (line.debit || 0) - (line.credit || 0);
    }
  }
  const out = {};
  for (const acc of CHART_OF_ACCOUNTS) {
    out[acc.code] = acc.normalBalance === "debit" ? raw[acc.code] : -raw[acc.code];
  }
  return out;
}

// Straight-line accumulated depreciation for one asset, as of a date —
// the same math Financials.jsx shows in the register, centralized here
// so the statements and the entry screen never disagree.
export function accumulatedDepreciationAsOf(asset, asOf) {
  const life = asset.usefulLifeYears || 5;
  if (life <= 0 || !asset.purchaseDate) return 0;
  const annual = (asset.cost || 0) / life;
  const start = new Date(asset.purchaseDate + "T00:00:00");
  const cutoff = asOf ? new Date(asOf + "T00:00:00") : new Date();
  const end = asset.disposalDate && asset.disposalDate < (asOf || "9999-12-31")
    ? new Date(asset.disposalDate + "T00:00:00")
    : cutoff;
  const yearsElapsed = Math.max(0, (end - start) / (365.25 * 24 * 3600 * 1000));
  return Math.min(asset.cost || 0, annual * yearsElapsed);
}

const dayBefore = (dateStr) => {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
};

const round2 = (n) => Math.round((n || 0) * 100) / 100;

// --- Income Statement -------------------------------------------------

export function incomeStatement(data, { from, to } = {}) {
  const lines = salesWithMargin(data).filter((s) => inRange(s.date, from, to));
  const soldLines = lines.filter((s) => !s.isGiveaway);
  const giveawayLines = lines.filter((s) => s.isGiveaway);

  const revenue = round2(soldLines.reduce((s, l) => s + l.revenue, 0));
  const cogs = round2(soldLines.reduce((s, l) => s + l.cogs, 0));
  const grossProfit = round2(revenue - cogs);

  const giveawayValue = round2(giveawayLines.reduce((s, l) => s + l.cogs, 0));

  const lossRows = productionLosses(data).filter((r) => inRange(r.date, from, to));
  const productionLossValue = round2(lossRows.reduce((s, r) => s + r.lossValue, 0));

  const spoilageValue = round2((data.spoilage || []).filter((s) => inRange(s.date, from, to)).reduce((s, r) => s + (r.valueLost || 0), 0));

  const expensesInRange = (data.operatingExpenses || []).filter((e) => inRange(e.date, from, to));
  const opexTotal = round2(expensesInRange.reduce((s, e) => s + (e.amount || 0), 0));
  const opexByCategory = Object.values(
    expensesInRange.reduce((acc, e) => {
      const key = e.category || "Other";
      if (!acc[key]) acc[key] = { category: key, amount: 0 };
      acc[key].amount += e.amount || 0;
      return acc;
    }, {})
  ).map((r) => ({ ...r, amount: round2(r.amount) })).sort((a, b) => b.amount - a.amount);

  const depreciationTotal = round2((data.fixedAssets || []).reduce((s, asset) => {
    const upToEnd = accumulatedDepreciationAsOf(asset, to);
    const upToStart = from ? accumulatedDepreciationAsOf(asset, dayBefore(from)) : 0;
    return s + Math.max(0, upToEnd - upToStart);
  }, 0));

  const totalOperatingExpenses = round2(opexTotal + giveawayValue + productionLossValue + spoilageValue + depreciationTotal);
  const netIncome = round2(grossProfit - totalOperatingExpenses);

  return {
    period: { from: from || null, to: to || null },
    revenue,
    cogs,
    grossProfit,
    grossMarginPct: revenue > 0 ? round2((grossProfit / revenue) * 100) : 0,
    operatingExpenses: {
      byCategory: opexByCategory,
      total: opexTotal,
      giveawayValue,
      productionLossValue,
      spoilageValue,
      depreciationTotal,
      total_all: totalOperatingExpenses,
    },
    netIncome,
  };
}

// --- Balance Sheet ------------------------------------------------------

export function balanceSheet(data, { asOf } = {}) {
  const asOfDate = asOf || new Date().toISOString().slice(0, 10);
  const snapshot = dataAsOf(data, asOfDate);
  const balances = ledgerBalancesAsOf(snapshot.journalEntries || [], asOfDate);

  const ledger = materialLedger(snapshot);
  const inv = finishedGoodsInventory(snapshot);
  const rawMaterialsValue = round2(ledger.reduce((s, r) => s + r.valueRemaining, 0));
  const finishedGoodsValue = round2(inv.reduce((s, r) => s + r.valueOnHand, 0));

  const receivables = round2(snapshot.salesOrders.reduce((s, order) => {
    const total = (order.items || []).reduce((sum, i) => sum + (i.isGiveaway ? 0 : i.quantity * i.unitPrice), 0) * (1 + (order.vatRate || 0) / 100);
    const paid = orderPaidTotal(order, total);
    return s + Math.max(0, total - paid);
  }, 0));

  const payables = round2(ledger.reduce((s, r) => s + Math.max(0, r.payable), 0));

  // VAT payable is collected alongside every historical sale, same as
  // receivables — so it's tracked from full sales history, not just the
  // ledger, unlike accrued expenses (which only exist from when Operating
  // Expenses started being logged).
  const vatPayable = round2(snapshot.salesOrders.reduce((s, o) => s + (o.vatAmount || 0), 0));
  const accruedExpenses = round2(Math.max(0, balances["2200"] || 0));

  const cashAndBank = round2(balances["1000"] || 0);

  const fixedAssetsCost = round2((snapshot.fixedAssets || []).reduce((s, a) => s + (a.cost || 0), 0));
  const accumulatedDepreciation = round2((snapshot.fixedAssets || []).reduce((s, a) => s + accumulatedDepreciationAsOf(a, asOfDate), 0));
  const fixedAssetsNet = round2(fixedAssetsCost - accumulatedDepreciation);

  const totalAssets = round2(cashAndBank + receivables + rawMaterialsValue + finishedGoodsValue + fixedAssetsNet);
  const totalLiabilities = round2(payables + vatPayable + accruedExpenses);

  const ownersCapital = round2(Math.max(0, balances["3000"] || 0));
  const ownersDrawings = round2(Math.max(0, balances["3100"] || 0));

  // Retained earnings is the balancing figure required for the accounting
  // equation to hold (Assets = Liabilities + Equity) — it necessarily
  // absorbs both real accumulated profit AND the value of inventory/
  // receivables built up before this ledger existed, since that history
  // was never separately recorded as cash in or equity contributed. See
  // the module comment at the top of this file.
  const retainedEarnings = round2(totalAssets - totalLiabilities - (ownersCapital - ownersDrawings));
  const totalEquity = round2(ownersCapital - ownersDrawings + retainedEarnings);

  return {
    asOf: asOfDate,
    assets: {
      cashAndBank,
      accountsReceivable: receivables,
      inventoryRawMaterials: rawMaterialsValue,
      inventoryFinishedGoods: finishedGoodsValue,
      fixedAssetsCost,
      accumulatedDepreciation,
      fixedAssetsNet,
      total: totalAssets,
    },
    liabilities: {
      accountsPayable: payables,
      vatPayable,
      accruedExpenses,
      total: totalLiabilities,
    },
    equity: {
      ownersCapital,
      ownersDrawings,
      retainedEarnings,
      total: totalEquity,
    },
    balances: totalAssets === round2(totalLiabilities + totalEquity),
  };
}

// --- Cash Flow Statement (direct method) --------------------------------

const CASH_FLOW_CATEGORY_BY_SOURCE = {
  sale: "operating",
  supply: "operating",
  production: "operating",
  spoilage: "operating",
  expense: "operating",
  fixed_asset: "investing",
  equity: "financing",
  manual: "operating",
};

export function cashFlowStatement(data, { from, to } = {}) {
  const toDate = to || new Date().toISOString().slice(0, 10);
  const entries = data.journalEntries || [];

  const openingAsOf = from ? dayBefore(from) : null;
  const opening = openingAsOf ? ledgerBalancesAsOf(entries, openingAsOf)["1000"] || 0 : 0;
  const closing = ledgerBalancesAsOf(entries, toDate)["1000"] || 0;

  const categories = { operating: 0, investing: 0, financing: 0 };
  const linesByCategory = { operating: [], investing: [], financing: [] };
  for (const entry of entries) {
    if (from && entry.date < from) continue;
    if (entry.date > toDate) continue;
    const cashLine = (entry.lines || []).find((l) => l.accountCode === "1000");
    if (!cashLine) continue;
    const amount = round2((cashLine.debit || 0) - (cashLine.credit || 0));
    if (Math.abs(amount) < 0.005) continue;
    const category = CASH_FLOW_CATEGORY_BY_SOURCE[entry.sourceType] || "operating";
    categories[category] += amount;
    linesByCategory[category].push({ date: entry.date, memo: entry.memo, amount });
  }

  const netChange = round2(categories.operating + categories.investing + categories.financing);

  return {
    period: { from: from || null, to: toDate },
    openingCash: round2(opening),
    operating: { total: round2(categories.operating), lines: linesByCategory.operating },
    investing: { total: round2(categories.investing), lines: linesByCategory.investing },
    financing: { total: round2(categories.financing), lines: linesByCategory.financing },
    netChange,
    closingCash: round2(closing),
    reconciles: Math.abs(round2(opening) + netChange - round2(closing)) < 0.02,
  };
}

export function accountLabel(code) {
  return ACCOUNTS_BY_CODE[code]?.name || code;
}
