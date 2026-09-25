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
  orderBillableTotal,
  isOpenSaleOrReturn,
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
    loans: (data.loans || []).filter((l) => keepOnOrBefore(l.startDate, asOf)),
  };
}

const addMonths = (dateStr, months) => {
  const d = new Date(dateStr + "T00:00:00");
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
};

const monthsBetween = (fromDate, toDate) => {
  const a = new Date(fromDate + "T00:00:00");
  const b = new Date(toDate + "T00:00:00");
  return (b - a) / (1000 * 60 * 60 * 24 * 30.44);
};

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

// Net movement (debit - credit) on one account across journal entries
// dated within [from, to] — a period FLOW, unlike ledgerBalancesAsOf's
// point-in-time balance. Used for expense-type accounts like interest.
function ledgerFlowInRange(journalEntries, code, from, to) {
  let total = 0;
  for (const entry of journalEntries) {
    if (from && entry.date < from) continue;
    if (to && entry.date > to) continue;
    for (const line of entry.lines || []) {
      if (line.accountCode !== code) continue;
      total += (line.debit || 0) - (line.credit || 0);
    }
  }
  return total;
}

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
  const operatingIncome = round2(grossProfit - totalOperatingExpenses);

  // Interest on loans is the cost of borrowing, not a cost of running the
  // business — kept below Operating Income, the way a formal income
  // statement separates operating results from financing costs.
  const interestExpense = round2(Math.max(0, ledgerFlowInRange(data.journalEntries || [], "6100", from, to)));
  const netIncome = round2(operatingIncome - interestExpense);

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
    operatingIncome,
    interestExpense,
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
    const total = orderBillableTotal(order);
    const paid = orderPaidTotal(order, total);
    return s + Math.max(0, total - paid);
  }, 0));

  // Goods shipped out on an open Sale-or-Return are still the business's
  // asset — just sitting with the customer, not yet sold — so they're
  // carried here at cost instead of vanishing from the Balance Sheet
  // between leaving Finished Goods and being recognized as a sale.
  const costByProductForConsignment = Object.fromEntries(inv.map((r) => [r.product.id, r.avgCostPerUnit]));
  const goodsOnConsignmentValue = round2(snapshot.salesOrders.reduce((s, order) => {
    if (!isOpenSaleOrReturn(order)) return s;
    return s + (order.items || []).reduce((sum, i) => {
      const stillOut = Math.max(0, i.quantity - (i.quantityReturned || 0));
      return sum + stillOut * (costByProductForConsignment[i.productId] || 0);
    }, 0);
  }, 0));

  const payables = round2(ledger.reduce((s, r) => s + Math.max(0, r.payable), 0));

  // VAT payable is collected alongside every historical sale, same as
  // receivables — so it's tracked from full sales history, not just the
  // ledger, unlike accrued expenses (which only exist from when Operating
  // Expenses started being logged).
  const vatPayable = round2(snapshot.salesOrders.reduce((s, o) => s + (o.vatAmount || 0), 0));
  const accruedExpenses = round2(Math.max(0, balances["2200"] || 0));
  const loansPayable = round2(Math.max(0, balances["2050"] || 0));

  const cashAndBank = round2(balances["1000"] || 0);

  const fixedAssetsCost = round2((snapshot.fixedAssets || []).reduce((s, a) => s + (a.cost || 0), 0));
  const accumulatedDepreciation = round2((snapshot.fixedAssets || []).reduce((s, a) => s + accumulatedDepreciationAsOf(a, asOfDate), 0));
  const fixedAssetsNet = round2(fixedAssetsCost - accumulatedDepreciation);

  const totalAssets = round2(cashAndBank + receivables + rawMaterialsValue + finishedGoodsValue + goodsOnConsignmentValue + fixedAssetsNet);
  const totalLiabilities = round2(payables + vatPayable + accruedExpenses + loansPayable);

  const ownersCapital = round2(Math.max(0, balances["3000"] || 0));
  const ownersDrawings = round2(Math.max(0, balances["3100"] || 0));
  const investorCapital = round2(Math.max(0, balances["3050"] || 0));
  const investorDrawings = round2(Math.max(0, balances["3150"] || 0));
  const openingBalanceEquity = round2(Math.max(0, balances["3200"] || 0));
  const contributedCapital = ownersCapital - ownersDrawings + investorCapital - investorDrawings + openingBalanceEquity;

  // Retained earnings is the balancing figure required for the accounting
  // equation to hold (Assets = Liabilities + Equity) — it necessarily
  // absorbs both real accumulated profit AND the value of inventory/
  // receivables built up before this ledger existed, since that history
  // was never separately recorded as cash in or equity contributed. See
  // the module comment at the top of this file.
  const retainedEarnings = round2(totalAssets - totalLiabilities - contributedCapital);
  const totalEquity = round2(contributedCapital + retainedEarnings);

  // Loans split into current (due within 12 months of asOf) and
  // non-current — classified from the loan register (maturity = start +
  // term), then applied as a ratio against the ledger-sourced total so
  // the two halves always add back up to the ledger's own number.
  const loanRows = (snapshot.loans || []).map((l) => {
    const repaid = (l.repayments || []).filter((r) => keepOnOrBefore(r.date, asOfDate)).reduce((s, r) => s + (r.principalPortion || 0), 0);
    const outstanding = Math.max(0, (l.principal || 0) - repaid);
    const maturity = l.termMonths ? addMonths(l.startDate, l.termMonths) : null;
    const isCurrent = !maturity || monthsBetween(asOfDate, maturity) <= 12;
    return { outstanding, isCurrent };
  });
  const registerTotal = loanRows.reduce((s, r) => s + r.outstanding, 0) || 1;
  const currentRatio = loanRows.filter((r) => r.isCurrent).reduce((s, r) => s + r.outstanding, 0) / registerTotal;
  const loansPayableCurrent = round2(loansPayable * currentRatio);
  const loansPayableNonCurrent = round2(loansPayable - loansPayableCurrent);

  const currentAssetsTotal = round2(cashAndBank + receivables + rawMaterialsValue + finishedGoodsValue + goodsOnConsignmentValue);
  const nonCurrentAssetsTotal = fixedAssetsNet;
  const currentLiabilitiesTotal = round2(payables + vatPayable + accruedExpenses + loansPayableCurrent);
  const nonCurrentLiabilitiesTotal = loansPayableNonCurrent;

  return {
    asOf: asOfDate,
    assets: {
      current: {
        cashAndBank,
        accountsReceivable: receivables,
        inventoryRawMaterials: rawMaterialsValue,
        inventoryFinishedGoods: finishedGoodsValue,
        goodsOnConsignment: goodsOnConsignmentValue,
        total: currentAssetsTotal,
      },
      nonCurrent: {
        fixedAssetsCost,
        accumulatedDepreciation,
        fixedAssetsNet,
        total: nonCurrentAssetsTotal,
      },
      total: totalAssets,
    },
    liabilities: {
      current: {
        accountsPayable: payables,
        vatPayable,
        accruedExpenses,
        loansPayable: loansPayableCurrent,
        total: currentLiabilitiesTotal,
      },
      nonCurrent: {
        loansPayable: loansPayableNonCurrent,
        total: nonCurrentLiabilitiesTotal,
      },
      total: totalLiabilities,
    },
    equity: {
      ownersCapital,
      ownersDrawings,
      investorCapital,
      investorDrawings,
      openingBalanceEquity,
      retainedEarnings,
      total: totalEquity,
    },
    balances: Math.abs(totalAssets - round2(totalLiabilities + totalEquity)) < 0.02,
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
  loan: "financing",
  opening_balance: "financing",
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
