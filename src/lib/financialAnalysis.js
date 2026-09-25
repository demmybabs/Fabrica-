// Generates the narrative that goes alongside the three statements in the
// exported PDF — written for an investor/CEO audience, and built entirely
// from the numbers already computed by incomeStatement/balanceSheet/
// cashFlowStatement, never invented. Every sentence traces back to a
// figure already shown on the statement it's commenting on.

const pct = (n) => `${(n || 0).toFixed(1)}%`;

function describeMargin(marginPct) {
  if (marginPct >= 40) return "a strong margin";
  if (marginPct >= 20) return "a healthy margin";
  if (marginPct >= 10) return "a modest margin";
  if (marginPct > 0) return "a thin margin";
  return "no margin — costs exceeded revenue";
}

export function incomeStatementAnalysis({ income, money }) {
  const lines = [];
  const opex = income.operatingExpenses;

  lines.push(
    `For the period ${income.period.from || "inception"} to ${income.period.to}, the business recorded ${money(income.revenue)} in revenue against ${money(income.cogs)} of cost of goods sold, ` +
    `producing a gross profit of ${money(income.grossProfit)} — ${describeMargin(income.grossMarginPct)} at ${pct(income.grossMarginPct)} of revenue.`
  );

  if (opex.total_all > 0) {
    const topCategory = [...(opex.byCategory || [])].sort((a, b) => b.amount - a.amount)[0];
    const opexPctOfRevenue = income.revenue > 0 ? (opex.total_all / income.revenue) * 100 : 0;
    lines.push(
      `Operating expenses totaled ${money(opex.total_all)}, equal to ${pct(opexPctOfRevenue)} of revenue.` +
      (topCategory ? ` The largest single category was ${topCategory.category} at ${money(topCategory.amount)}.` : "") +
      (opex.giveawayValue > 0 ? ` ${money(opex.giveawayValue)} was given away for marketing/CSR purposes and is expensed at cost, not revenue foregone.` : "") +
      (opex.productionLossValue > 0 || opex.spoilageValue > 0
        ? ` Production loss and spoilage together removed ${money(opex.productionLossValue + opex.spoilageValue)} of value before it ever reached a customer — a direct efficiency target.`
        : "")
    );
  }

  const netMarginPct = income.revenue > 0 ? (income.netIncome / income.revenue) * 100 : 0;
  lines.push(
    income.netIncome >= 0
      ? `After ${money(income.interestExpense)} of interest expense, net income for the period was ${money(income.netIncome)} — a net margin of ${pct(netMarginPct)}.`
      : `After ${money(income.interestExpense)} of interest expense, the period closed with a net loss of ${money(Math.abs(income.netIncome))}, a signal to review pricing, cost of goods, or operating expense discipline before the next period.`
  );

  return lines;
}

export function balanceSheetAnalysis({ balance, money }) {
  const lines = [];
  const currentRatio = balance.liabilities.current.total > 0
    ? balance.assets.current.total / balance.liabilities.current.total
    : null;
  const workingCapital = balance.assets.current.total - balance.liabilities.current.total;
  const debtToEquity = balance.equity.total > 0 ? balance.liabilities.total / balance.equity.total : null;

  lines.push(
    `As of ${balance.asOf}, total assets stood at ${money(balance.assets.total)}, of which ${money(balance.assets.current.total)} is current (cash, receivables, inventory) and ` +
    `${money(balance.assets.nonCurrent.total)} is non-current (net fixed assets).`
  );

  lines.push(
    currentRatio !== null
      ? `The current ratio is ${currentRatio.toFixed(2)} (${money(balance.assets.current.total)} of current assets against ${money(balance.liabilities.current.total)} of current liabilities), leaving working capital of ${money(workingCapital)}. ` +
        (currentRatio >= 1.5
          ? "This is a comfortable liquidity position — short-term obligations are well covered."
          : currentRatio >= 1
          ? "This covers short-term obligations, though with limited headroom."
          : "This is below 1.0, meaning current liabilities exceed current assets — a liquidity position worth addressing before it constrains operations.")
      : `There are no current liabilities on record as of ${balance.asOf}, so working capital of ${money(workingCapital)} sits entirely uncommitted.`
  );

  lines.push(
    debtToEquity !== null
      ? `Total liabilities of ${money(balance.liabilities.total)} against total equity of ${money(balance.equity.total)} give a debt-to-equity ratio of ${debtToEquity.toFixed(2)}. ` +
        (debtToEquity <= 0.5
          ? "The business is conservatively financed, with equity funding the majority of assets."
          : debtToEquity <= 1.5
          ? "This is a moderate level of leverage."
          : "This is a highly leveraged position — debt obligations are large relative to the equity base, worth monitoring closely against cash flow.")
      : `Total liabilities of ${money(balance.liabilities.total)} are recorded against a nil or negative equity base, which warrants attention.`
  );

  if (balance.assets.current.goodsOnConsignment > 0) {
    lines.push(
      `${money(balance.assets.current.goodsOnConsignment)} of finished goods are currently out with customers on an open Sale-or-Return basis — shipped but not yet billed, and excluded from revenue until closed.`
    );
  }

  lines.push(
    balance.balances
      ? "The accounting equation holds — assets equal liabilities plus equity, confirming the statement is internally consistent."
      : "The accounting equation does not currently balance — this indicates a data issue that should be investigated before the statement is relied upon."
  );

  return lines;
}

export function cashFlowAnalysis({ cashFlow, money }) {
  const lines = [];
  lines.push(
    `Cash & Bank moved from ${money(cashFlow.openingCash)} to ${money(cashFlow.closingCash)} over the period ${cashFlow.period.from || "inception"} to ${cashFlow.period.to}, ` +
    `a net change of ${money(cashFlow.netChange)}.`
  );

  const parts = [];
  if (Math.abs(cashFlow.operating.total) > 0.004) parts.push(`${money(cashFlow.operating.total)} from operating activities`);
  if (Math.abs(cashFlow.investing.total) > 0.004) parts.push(`${money(cashFlow.investing.total)} from investing activities`);
  if (Math.abs(cashFlow.financing.total) > 0.004) parts.push(`${money(cashFlow.financing.total)} from financing activities`);
  if (parts.length > 0) {
    lines.push(`This breaks down into ${parts.join(", ")}.`);
  }

  lines.push(
    cashFlow.operating.total >= 0
      ? "Operations were a net source of cash for the period — the core business is self-funding at this scale."
      : "Operations were a net use of cash for the period — growth or working-capital needs are currently being funded from elsewhere (financing or existing cash reserves), worth watching if it continues."
  );

  return lines;
}

export const financialNotes = [
  {
    heading: "Basis of preparation",
    body: "These statements are prepared on a going-concern, historical-cost basis, from the business's own transaction records. They are unaudited and intended for internal management, ownership, and investor use.",
  },
  {
    heading: "Revenue recognition",
    body: "Revenue is recognized at the point of sale for an ordinary transaction. A Sale-or-Return (consignment) order recognizes no revenue, cost of goods sold, or VAT until it is closed — at which point only the units the customer actually kept are recognized; returned units are restored to Finished Goods inventory at cost.",
  },
  {
    heading: "Inventory valuation",
    body: "Raw materials and finished goods are valued at weighted-average cost. Finished-goods cost is allocated from production runs (materials consumed, labor, and overhead) across the units produced.",
  },
  {
    heading: "Fixed assets and depreciation",
    body: "Fixed assets are recorded at cost and depreciated on a straight-line basis over each asset's useful life. Net book value (cost less accumulated depreciation) is what's carried on the Balance Sheet.",
  },
  {
    heading: "Receivables and payables",
    body: "Receivables and payables reflect full transaction history. A receivable's due date is the transaction date plus the receivables-days term on file (business default, or an override on that specific sale); a status of Due appears once the due date arrives, and Overdue once it is more than 5 days past due. The same logic applies to payables owed to suppliers.",
  },
  {
    heading: "Equity",
    body: "Owner's and Investor's capital/drawings are tracked on separate accounts so one party's stake is never mixed into another's. An Opening Balance Equity account records the one-time cash balance on hand before this ledger went live, distinct from a fresh capital contribution. Debt (loans) is kept entirely separate from equity, as it carries a repayment obligation and interest that an ownership stake does not.",
  },
  {
    heading: "Cash & Bank, VAT, and equity — go-live boundary",
    body: "Cash & Bank, VAT/accrued liabilities, and Owner's/Investor's Equity are tracked from the day this Financials module went live, not backfilled from history before then. Revenue, cost of goods sold, receivables, payables, and inventory value reflect the business's complete history regardless. For any period spanning the go-live date, Retained Earnings on the Balance Sheet absorbs the pre-existing history so the statement still balances.",
  },
];
