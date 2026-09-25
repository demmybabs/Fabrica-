import { useState } from "react";
import { useApp, useMoney } from "../lib/AppContext";
import { useConfirm } from "../lib/ConfirmContext";
import { postJournalEntry, journalForExpense, journalForFixedAsset, journalForEquity, journalForLoan, journalForLoanRepayment, journalForOpeningBalance } from "../lib/ledger";
import { accumulatedDepreciationAsOf, incomeStatement, balanceSheet, cashFlowStatement } from "../lib/financials";
import { sortByDateDesc } from "../lib/calc";
import Panel from "../components/Panel";
import { Field, inputCls, btnCls, btnGhostCls } from "../components/Field";

const DEFAULT_EXPENSE_CATEGORIES = ["Rent", "Salaries & wages", "Utilities", "Transport & logistics", "Marketing", "Professional fees", "Repairs & maintenance", "Insurance", "Bank charges", "Other"];
const blankExpense = { date: "", category: "", description: "", amount: "", amountPaid: "" };
const blankAsset = { name: "", category: "", cost: "", purchaseDate: "", usefulLifeYears: "5", notes: "" };
const blankEquity = { date: "", type: "contribution", holder: "owner", amount: "", notes: "" };
const blankLoan = { lender: "", principal: "", startDate: "", interestRate: "", termMonths: "", notes: "" };

const tabs = [
  { key: "statements", label: "Statements" },
  { key: "expenses", label: "Operating expenses" },
  { key: "assets", label: "Fixed assets" },
  { key: "equity", label: "Owner's equity" },
  { key: "loans", label: "Loans / debt" },
];

export default function Financials() {
  const { data, add, update, remove, addExpenseCategory } = useApp();
  const confirmAction = useConfirm();
  const money = useMoney();
  const [tab, setTab] = useState("statements");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="chip text-ink-400 uppercase">Module 07</div>
          <h1 className="font-display text-xl font-semibold text-ink-50">Financials</h1>
          <p className="text-sm text-ink-400 mt-1 max-w-lg">
            Operating expenses, fixed assets, owner's/investor's equity, and loans feed the ledger
            behind the Income Statement, Balance Sheet, and Cash Flow Statement.
          </p>
        </div>
      </div>

      <div className="flex gap-1 border-b border-ink-700">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm border-b-2 -mb-px transition-colors ${
              tab === t.key ? "border-[var(--accent)] text-ink-50" : "border-transparent text-ink-400 hover:text-ink-100"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "statements" && <StatementsTab data={data} add={add} remove={remove} confirmAction={confirmAction} money={money} />}
      {tab === "expenses" && <ExpensesTab data={data} add={add} remove={remove} confirmAction={confirmAction} money={money} addExpenseCategory={addExpenseCategory} />}
      {tab === "assets" && <AssetsTab data={data} add={add} remove={remove} confirmAction={confirmAction} money={money} />}
      {tab === "equity" && <EquityTab data={data} add={add} remove={remove} confirmAction={confirmAction} money={money} />}
      {tab === "loans" && <LoansTab data={data} add={add} update={update} remove={remove} confirmAction={confirmAction} money={money} />}
    </div>
  );
}

const startOfMonth = (d) => `${d.slice(0, 7)}-01`;
const todayStr = () => new Date().toISOString().slice(0, 10);

function StatementsTab({ data, add, remove, confirmAction, money }) {
  const [from, setFrom] = useState(startOfMonth(todayStr()));
  const [to, setTo] = useState(todayStr());
  const [asOf, setAsOf] = useState(todayStr());
  const [syncAsOf, setSyncAsOf] = useState(true);
  const [exporting, setExporting] = useState(false);

  const applyTo = (value) => {
    setTo(value);
    if (syncAsOf) setAsOf(value);
  };
  const applyAsOf = (value) => {
    setAsOf(value);
    setSyncAsOf(false);
  };

  const setPreset = (preset) => {
    const today = todayStr();
    if (preset === "thisMonth") { setFrom(startOfMonth(today)); applyTo(today); }
    else if (preset === "thisYear") { setFrom(`${today.slice(0, 4)}-01-01`); applyTo(today); }
    else if (preset === "allTime") { setFrom(""); applyTo(today); }
  };

  const income = incomeStatement(data, { from: from || null, to });
  const balance = balanceSheet(data, { asOf });
  const cashFlow = cashFlowStatement(data, { from: from || null, to });

  const spansPreLedger = !data.journalEntries || data.journalEntries.length === 0
    ? true
    : from && data.journalEntries.every((j) => j.date > from);

  const exportPdf = async () => {
    setExporting(true);
    try {
      // Loaded on demand — @react-pdf/renderer is heavy, and most visits
      // to this page are just checking numbers, not exporting a PDF.
      const { downloadFinancialStatementsPdf } = await import("../lib/financialsPdf");
      await downloadFinancialStatementsPdf({
        branding: data.branding,
        money,
        income,
        balance,
        cashFlow,
        fileName: `${(data.branding?.name || "Fabrica").replace(/\s+/g, "-")}-financials-${asOf}.pdf`,
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Panel
        title="Period"
        eyebrow="Income Statement and Cash Flow cover the date range; Balance Sheet is a snapshot as of one date"
        actions={<button type="button" className={btnCls} onClick={exportPdf} disabled={exporting}>{exporting ? "Preparing PDF…" : "Export PDF"}</button>}
      >
        <div className="flex flex-wrap items-end gap-4">
          <Field label="From">
            <input type="date" className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="To">
            <input type="date" className={inputCls} value={to} onChange={(e) => applyTo(e.target.value)} />
          </Field>
          <Field label="Balance sheet as of">
            <input type="date" className={inputCls} value={asOf} onChange={(e) => applyAsOf(e.target.value)} />
          </Field>
          <div className="flex gap-2 pb-0.5">
            <button type="button" className={btnGhostCls} onClick={() => setPreset("thisMonth")}>This month</button>
            <button type="button" className={btnGhostCls} onClick={() => setPreset("thisYear")}>This year</button>
            <button type="button" className={btnGhostCls} onClick={() => setPreset("allTime")}>All time</button>
          </div>
        </div>
      </Panel>

      {spansPreLedger && (
        <div className="chip text-ink-400 bg-ink-800 border border-ink-700 rounded-lg px-4 py-3 leading-relaxed normal-case">
          Cash &amp; Bank, VAT/accrued liabilities, and Owner's Equity are tracked from the day this
          Financials module went live — not backfilled. Revenue, COGS, receivables, payables, and
          inventory value are unaffected and reflect full history. For a period that starts before
          go-live, the Balance Sheet's Retained Earnings absorbs that pre-existing history so the
          sheet still balances; Cash Flow for that period reflects only ledger-tracked movement.
        </div>
      )}

      <OpeningBalancePanel data={data} add={add} remove={remove} confirmAction={confirmAction} money={money} />
      <IncomeStatementPanel income={income} money={money} />
      <BalanceSheetPanel balance={balance} money={money} />
      <CashFlowPanel cashFlow={cashFlow} money={money} />
    </div>
  );
}

function OpeningBalancePanel({ data, add, remove, confirmAction, money }) {
  const existing = (data.journalEntries || []).find((j) => j.sourceType === "opening_balance");
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayStr());

  if (existing) {
    const line = (existing.lines || []).find((l) => l.accountCode === "1000");
    const existingAmount = line?.debit || 0;
    const onRemove = async () => {
      if (await confirmAction("Remove this opening cash balance? This can't be undone.", { danger: true, confirmLabel: "Remove" })) {
        remove("journalEntries", existing.id);
      }
    };
    return (
      <Panel title="Opening cash balance" eyebrow="The cash/bank you were already holding before this Financials module went live">
        <div className="flex items-center justify-between text-sm">
          <div>
            <span className="text-ink-200">{money(existingAmount)}</span>
            <span className="text-ink-500 ml-2">as of {existing.date}</span>
          </div>
          <button type="button" className={btnGhostCls} onClick={onRemove}>Remove</button>
        </div>
      </Panel>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    const amt = parseFloat(amount) || 0;
    if (amt <= 0) return;
    await postJournalEntry(add, journalForOpeningBalance({ amount: amt, date }));
    setAmount("");
    setOpen(false);
  };

  return (
    <Panel
      title="Opening cash balance"
      eyebrow="Record the cash/bank you were already holding before this Financials module went live"
      actions={!open && <button type="button" className={btnGhostCls} onClick={() => setOpen(true)}>+ Add opening balance</button>}
    >
      {open ? (
        <form onSubmit={submit} className="flex flex-wrap items-end gap-4">
          <Field label="Amount">
            <input type="number" step="0.01" min="0" className={inputCls} value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </Field>
          <Field label="As of date">
            <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} required />
          </Field>
          <div className="flex gap-2 pb-0.5">
            <button type="submit" className={btnCls}>Save</button>
            <button type="button" className={btnGhostCls} onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </form>
      ) : (
        <p className="text-sm text-ink-400">Not yet recorded — Cash & Bank on the Balance Sheet reflects only ledger activity since go-live until this is added.</p>
      )}
    </Panel>
  );
}

function IncomeStatementPanel({ income, money }) {
  const opex = income.operatingExpenses;
  return (
    <Panel title="Income Statement" eyebrow={`${income.period.from || "Inception"} to ${income.period.to}`}>
      <div className="space-y-1 text-sm">
        <Row label="Revenue" value={money(income.revenue)} strong />
        <Row label="Cost of goods sold" value={`(${money(income.cogs)})`} indent />
        <Row label="Gross profit" value={money(income.grossProfit)} strong divider />
        <Row label={`Gross margin`} value={`${income.grossMarginPct}%`} muted />

        <div className="pt-3">
          <div className="chip text-ink-400 uppercase mb-1">Operating expenses</div>
          {opex.byCategory.map((c) => <Row key={c.category} label={c.category} value={`(${money(c.amount)})`} indent />)}
          <Row label="Marketing / CSR — product giveaways" value={`(${money(opex.giveawayValue)})`} indent />
          <Row label="Production loss" value={`(${money(opex.productionLossValue)})`} indent />
          <Row label="Spoilage" value={`(${money(opex.spoilageValue)})`} indent />
          <Row label="Depreciation" value={`(${money(opex.depreciationTotal)})`} indent />
          <Row label="Total operating expenses" value={`(${money(opex.total_all)})`} strong divider />
        </div>

        <Row label="Operating income" value={money(income.operatingIncome)} strong divider />
        <Row label="Interest expense" value={`(${money(income.interestExpense)})`} indent />
        <Row label="Net income" value={money(income.netIncome)} strong divider large />
      </div>
    </Panel>
  );
}

function BalanceSheetPanel({ balance, money }) {
  return (
    <Panel title="Balance Sheet" eyebrow={`As of ${balance.asOf}`}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-sm">
        <div>
          <div className="chip text-ink-400 uppercase mb-1">Current assets</div>
          <Row label="Cash & Bank" value={money(balance.assets.current.cashAndBank)} />
          <Row label="Accounts receivable" value={money(balance.assets.current.accountsReceivable)} />
          <Row label="Inventory — raw materials" value={money(balance.assets.current.inventoryRawMaterials)} />
          <Row label="Inventory — finished goods" value={money(balance.assets.current.inventoryFinishedGoods)} />
          {balance.assets.current.goodsOnConsignment > 0 && <Row label="Goods on consignment (open Sale or Return)" value={money(balance.assets.current.goodsOnConsignment)} />}
          <Row label="Total current assets" value={money(balance.assets.current.total)} strong divider />

          <div className="chip text-ink-400 uppercase mb-1 mt-4">Non-current assets</div>
          <Row label="Fixed assets, at cost" value={money(balance.assets.nonCurrent.fixedAssetsCost)} />
          <Row label="Accumulated depreciation" value={`(${money(balance.assets.nonCurrent.accumulatedDepreciation)})`} indent />
          <Row label="Total non-current assets" value={money(balance.assets.nonCurrent.total)} strong divider />

          <Row label="Total assets" value={money(balance.assets.total)} strong divider large />
        </div>
        <div>
          <div className="chip text-ink-400 uppercase mb-1">Current liabilities</div>
          <Row label="Accounts payable" value={money(balance.liabilities.current.accountsPayable)} />
          <Row label="Loans payable (current portion)" value={money(balance.liabilities.current.loansPayable)} />
          <Row label="VAT payable" value={money(balance.liabilities.current.vatPayable)} />
          <Row label="Accrued expenses" value={money(balance.liabilities.current.accruedExpenses)} />
          <Row label="Total current liabilities" value={money(balance.liabilities.current.total)} strong divider />

          <div className="chip text-ink-400 uppercase mb-1 mt-4">Non-current liabilities</div>
          <Row label="Loans payable (long-term)" value={money(balance.liabilities.nonCurrent.loansPayable)} />
          <Row label="Total non-current liabilities" value={money(balance.liabilities.nonCurrent.total)} strong divider />

          <Row label="Total liabilities" value={money(balance.liabilities.total)} strong divider />

          <div className="chip text-ink-400 uppercase mb-1 mt-4">Equity</div>
          <Row label="Owner's capital" value={money(balance.equity.ownersCapital)} />
          <Row label="Owner's drawings" value={`(${money(balance.equity.ownersDrawings)})`} indent />
          <Row label="Investor capital" value={money(balance.equity.investorCapital)} />
          <Row label="Investor drawings / redemptions" value={`(${money(balance.equity.investorDrawings)})`} indent />
          <Row label="Opening balance equity" value={money(balance.equity.openingBalanceEquity)} />
          <Row label="Retained earnings" value={money(balance.equity.retainedEarnings)} />
          <Row label="Total equity" value={money(balance.equity.total)} strong divider />
        </div>
      </div>
      <p className={`text-xs mt-4 ${balance.balances ? "text-ink-500" : "text-[var(--accent)]"}`}>
        {balance.balances ? "Assets = Liabilities + Equity — the sheet balances." : "This sheet doesn't balance — check for a data issue."}
      </p>
    </Panel>
  );
}

function CashFlowPanel({ cashFlow, money }) {
  return (
    <Panel title="Cash Flow Statement" eyebrow={`${cashFlow.period.from || "Inception"} to ${cashFlow.period.to} · direct method`}>
      <div className="space-y-1 text-sm">
        <Row label="Opening cash & bank" value={money(cashFlow.openingCash)} />
        <div className="pt-2">
          <Row label="Operating activities" value={money(cashFlow.operating.total)} indent />
          <Row label="Investing activities" value={money(cashFlow.investing.total)} indent />
          <Row label="Financing activities" value={money(cashFlow.financing.total)} indent />
        </div>
        <Row label="Net change in cash" value={money(cashFlow.netChange)} strong divider />
        <Row label="Closing cash & bank" value={money(cashFlow.closingCash)} strong large />
      </div>
    </Panel>
  );
}

function Row({ label, value, strong, indent, muted, divider, large }) {
  return (
    <div className={`flex items-center justify-between py-1 ${divider ? "border-t border-ink-700 mt-1 pt-2" : ""}`}>
      <span className={`${indent ? "pl-4" : ""} ${muted ? "text-ink-500 text-xs" : "text-ink-200"} ${strong ? "font-semibold text-ink-50" : ""}`}>{label}</span>
      <span className={`chip ${large ? "text-base" : ""} ${strong ? "text-ink-50 font-semibold" : "text-ink-200"}`}>{value}</span>
    </div>
  );
}

function ExpensesTab({ data, add, remove, confirmAction, money, addExpenseCategory }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blankExpense);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategory, setNewCategory] = useState("");

  const categories = (data.expenseCategories && data.expenseCategories.length > 0) ? data.expenseCategories : DEFAULT_EXPENSE_CATEGORIES;
  const currentCategory = form.category || categories[0] || "";

  const total = (data.operatingExpenses || []).reduce((s, e) => s + (e.amount || 0), 0);
  const totalPaid = (data.operatingExpenses || []).reduce((s, e) => s + (e.amountPaid || 0), 0);

  const submit = async (e) => {
    e.preventDefault();
    const record = {
      date: form.date || new Date().toISOString().slice(0, 10),
      category: currentCategory,
      description: form.description,
      amount: parseFloat(form.amount) || 0,
      amountPaid: parseFloat(form.amountPaid) || 0,
    };
    const result = await add("operatingExpenses", record);
    if (result?.ok !== false) {
      await postJournalEntry(add, journalForExpense({ ...record, id: result.id }));
    }
    setForm(blankExpense);
    setOpen(false);
  };

  const saveNewCategory = () => {
    const name = newCategory.trim();
    if (!name) return;
    addExpenseCategory(name);
    setForm({ ...form, category: name });
    setNewCategory("");
    setAddingCategory(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
          <div className="bg-ink-800 border border-ink-700 rounded-lg px-5 py-4">
            <div className="chip text-ink-400 uppercase">Total expenses</div>
            <div className="font-display text-2xl font-semibold text-brass-400 mt-1.5">{money(total)}</div>
          </div>
          <div className="bg-ink-800 border border-ink-700 rounded-lg px-5 py-4">
            <div className="chip text-ink-400 uppercase">Paid so far</div>
            <div className="font-display text-2xl font-semibold text-[var(--accent)] mt-1.5">{money(totalPaid)}</div>
          </div>
        </div>
        <button className={btnGhostCls} onClick={() => setOpen((o) => !o)}>{open ? "Cancel" : "+ Log expense"}</button>
      </div>

      {open && (
        <Panel title="Log an operating expense" eyebrow="Rent, salaries, utilities, and everything else that isn't cost of goods sold">
          <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
            <Field label="Category">
              {addingCategory ? (
                <div className="flex gap-1.5">
                  <input className={inputCls} value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="New category name" autoFocus />
                  <button type="button" className={btnGhostCls} onClick={saveNewCategory}>Add</button>
                  <button type="button" className="chip text-ink-500 hover:text-ink-300" onClick={() => { setAddingCategory(false); setNewCategory(""); }}>×</button>
                </div>
              ) : (
                <select
                  className={inputCls}
                  value={currentCategory}
                  onChange={(e) => (e.target.value === "__new__" ? setAddingCategory(true) : setForm({ ...form, category: e.target.value }))}
                >
                  {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                  <option value="__new__">+ New category…</option>
                </select>
              )}
            </Field>
            <Field label="Description">
              <input className={inputCls} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g. September office rent" />
            </Field>
            <Field label="Amount"><input type="number" min="0" step="0.01" className={inputCls} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required /></Field>
            <Field label="Amount paid now">
              <input type="number" min="0" step="0.01" className={inputCls} value={form.amountPaid} onChange={(e) => setForm({ ...form, amountPaid: e.target.value })} placeholder="Leave blank if unpaid" />
            </Field>
            <Field label="Date"><input type="date" className={inputCls} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
            <div className="col-span-1 sm:col-span-2 md:col-span-5 flex justify-end pt-1">
              <button type="submit" className={btnCls}>Save</button>
            </div>
          </form>
        </Panel>
      )}

      <Panel title="Expense log" eyebrow="Every operating expense recorded, most recent first">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: "600px" }}>
            <thead>
              <tr className="text-left chip text-ink-500 uppercase border-b border-ink-700">
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Category</th>
                <th className="py-2 pr-4">Description</th>
                <th className="py-2 pr-4 text-right">Amount</th>
                <th className="py-2 pr-4 text-right">Paid</th>
                <th className="py-2 pr-4 text-right">Accrued</th>
                <th className="py-2 pr-4"></th>
              </tr>
            </thead>
            <tbody>
              {sortByDateDesc(data.operatingExpenses, "date").map((ex) => (
                <tr key={ex.id} className="border-b border-ink-700/60 text-ink-200">
                  <td className="py-2 pr-4 chip">{ex.date}</td>
                  <td className="py-2 pr-4">{ex.category}</td>
                  <td className="py-2 pr-4 text-ink-400 text-xs">{ex.description || "—"}</td>
                  <td className="py-2 pr-4 text-right chip">{money(ex.amount)}</td>
                  <td className="py-2 pr-4 text-right chip">{money(ex.amountPaid || 0)}</td>
                  <td className="py-2 pr-4 text-right chip">{money(Math.max(0, (ex.amount || 0) - (ex.amountPaid || 0)))}</td>
                  <td className="py-2 pr-4 text-right"><button className="text-ink-500 hover:text-[var(--accent)] text-xs" onClick={async () => { if (await confirmAction("Remove this expense? This can't be undone.", { danger: true, confirmLabel: "Remove" })) remove("operatingExpenses", ex.id); }}>remove</button></td>
                </tr>
              ))}
              {(data.operatingExpenses || []).length === 0 && <tr><td colSpan={7} className="py-6 text-center text-ink-500">No expenses logged yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function AssetsTab({ data, add, remove, confirmAction, money }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blankAsset);

  const totalCost = (data.fixedAssets || []).reduce((s, a) => s + (a.cost || 0), 0);
  const today = new Date().toISOString().slice(0, 10);
  const accumulatedDepreciation = (asset) => accumulatedDepreciationAsOf(asset, today);
  const totalDepreciation = (data.fixedAssets || []).reduce((s, a) => s + accumulatedDepreciation(a), 0);

  const submit = async (e) => {
    e.preventDefault();
    const record = {
      name: form.name,
      category: form.category,
      cost: parseFloat(form.cost) || 0,
      purchaseDate: form.purchaseDate || today,
      usefulLifeYears: parseFloat(form.usefulLifeYears) || 5,
      notes: form.notes,
    };
    const result = await add("fixedAssets", record);
    if (result?.ok !== false) {
      await postJournalEntry(add, journalForFixedAsset({ ...record, id: result.id }));
    }
    setForm(blankAsset);
    setOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-1">
          <div className="bg-ink-800 border border-ink-700 rounded-lg px-5 py-4">
            <div className="chip text-ink-400 uppercase">Assets, at cost</div>
            <div className="font-display text-2xl font-semibold text-brass-400 mt-1.5">{money(totalCost)}</div>
          </div>
          <div className="bg-ink-800 border border-ink-700 rounded-lg px-5 py-4">
            <div className="chip text-ink-400 uppercase">Accumulated depreciation</div>
            <div className="font-display text-2xl font-semibold text-[var(--accent)] mt-1.5">{money(totalDepreciation)}</div>
          </div>
          <div className="bg-ink-800 border border-ink-700 rounded-lg px-5 py-4">
            <div className="chip text-ink-400 uppercase">Net book value</div>
            <div className="font-display text-2xl font-semibold text-ink-50 mt-1.5">{money(totalCost - totalDepreciation)}</div>
          </div>
        </div>
        <button className={btnGhostCls} onClick={() => setOpen((o) => !o)}>{open ? "Cancel" : "+ Add asset"}</button>
      </div>

      {open && (
        <Panel title="Add a fixed asset" eyebrow="Straight-line depreciation, calculated automatically from cost, purchase date, and useful life">
          <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
            <Field label="Asset name"><input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Delivery van" required /></Field>
            <Field label="Category"><input className={inputCls} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. Vehicle, Equipment" /></Field>
            <Field label="Cost"><input type="number" min="0" step="0.01" className={inputCls} value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} required /></Field>
            <Field label="Purchase date"><input type="date" className={inputCls} value={form.purchaseDate} onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })} /></Field>
            <Field label="Useful life (years)"><input type="number" min="1" step="1" className={inputCls} value={form.usefulLifeYears} onChange={(e) => setForm({ ...form, usefulLifeYears: e.target.value })} /></Field>
            <div className="col-span-1 sm:col-span-2 md:col-span-5">
              <Field label="Notes">
                <input className={inputCls} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional" />
              </Field>
            </div>
            <div className="col-span-1 sm:col-span-2 md:col-span-5 flex justify-end pt-1">
              <button type="submit" className={btnCls}>Save</button>
            </div>
          </form>
        </Panel>
      )}

      <Panel title="Fixed asset register" eyebrow="Depreciation is calculated live, as of today — not posted as periodic entries">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: "700px" }}>
            <thead>
              <tr className="text-left chip text-ink-500 uppercase border-b border-ink-700">
                <th className="py-2 pr-4">Asset</th>
                <th className="py-2 pr-4">Category</th>
                <th className="py-2 pr-4">Purchased</th>
                <th className="py-2 pr-4 text-right">Cost</th>
                <th className="py-2 pr-4 text-right">Useful life</th>
                <th className="py-2 pr-4 text-right">Acc. depreciation</th>
                <th className="py-2 pr-4 text-right">Net book value</th>
                <th className="py-2 pr-4"></th>
              </tr>
            </thead>
            <tbody>
              {sortByDateDesc(data.fixedAssets, "purchaseDate").map((a) => {
                const dep = accumulatedDepreciation(a);
                return (
                  <tr key={a.id} className="border-b border-ink-700/60 text-ink-200">
                    <td className="py-2 pr-4">{a.name}</td>
                    <td className="py-2 pr-4 text-ink-400 text-xs">{a.category || "—"}</td>
                    <td className="py-2 pr-4 chip">{a.purchaseDate}</td>
                    <td className="py-2 pr-4 text-right chip">{money(a.cost)}</td>
                    <td className="py-2 pr-4 text-right chip">{a.usefulLifeYears} yrs</td>
                    <td className="py-2 pr-4 text-right chip">{money(dep)}</td>
                    <td className="py-2 pr-4 text-right chip text-brass-400">{money((a.cost || 0) - dep)}</td>
                    <td className="py-2 pr-4 text-right"><button className="text-ink-500 hover:text-[var(--accent)] text-xs" onClick={async () => { if (await confirmAction("Remove this asset? This can't be undone.", { danger: true, confirmLabel: "Remove" })) remove("fixedAssets", a.id); }}>remove</button></td>
                  </tr>
                );
              })}
              {(data.fixedAssets || []).length === 0 && <tr><td colSpan={8} className="py-6 text-center text-ink-500">No fixed assets logged yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function EquityTab({ data, add, remove, confirmAction, money }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blankEquity);

  const txByHolder = (holder) => (data.equityTransactions || []).filter((t) => (t.holder || "owner") === holder);
  const sumType = (rows, type) => rows.filter((t) => t.type === type).reduce((s, t) => s + (t.amount || 0), 0);
  const ownerRows = txByHolder("owner");
  const investorRows = txByHolder("investor");
  const ownerContrib = sumType(ownerRows, "contribution");
  const ownerDraw = sumType(ownerRows, "drawing");
  const investorContrib = sumType(investorRows, "contribution");
  const investorDraw = sumType(investorRows, "drawing");

  const submit = async (e) => {
    e.preventDefault();
    const record = {
      date: form.date || new Date().toISOString().slice(0, 10),
      type: form.type,
      holder: form.holder,
      amount: parseFloat(form.amount) || 0,
      notes: form.notes,
    };
    const result = await add("equityTransactions", record);
    if (result?.ok !== false) {
      await postJournalEntry(add, journalForEquity({ ...record, id: result.id }));
    }
    setForm(blankEquity);
    setOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
          <div className="bg-ink-800 border border-ink-700 rounded-lg px-5 py-4">
            <div className="chip text-ink-400 uppercase">Owner's net equity</div>
            <div className="font-display text-2xl font-semibold text-brass-400 mt-1.5">{money(ownerContrib - ownerDraw)}</div>
            <div className="chip text-ink-500 mt-1">{money(ownerContrib)} in · {money(ownerDraw)} out</div>
          </div>
          <div className="bg-ink-800 border border-ink-700 rounded-lg px-5 py-4">
            <div className="chip text-ink-400 uppercase">Investor net equity</div>
            <div className="font-display text-2xl font-semibold text-[var(--accent)] mt-1.5">{money(investorContrib - investorDraw)}</div>
            <div className="chip text-ink-500 mt-1">{money(investorContrib)} in · {money(investorDraw)} out</div>
          </div>
        </div>
        <button className={btnGhostCls} onClick={() => setOpen((o) => !o)}>{open ? "Cancel" : "+ Log contribution / drawing"}</button>
      </div>

      <p className="text-xs text-ink-500">
        Equity is money with no repayment obligation — the owner's or an outside investor's stake in
        the business. Borrowed money (a bank loan, a director's loan) is debt, not equity — log that
        under Loans / debt instead, since it carries a repayment schedule and interest.
      </p>

      {open && (
        <Panel title="Log a capital contribution or drawing" eyebrow="Money the owner or an investor puts into the business, or takes out of it">
          <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
            <Field label="Who">
              <select className={inputCls} value={form.holder} onChange={(e) => setForm({ ...form, holder: e.target.value })}>
                <option value="owner">Owner</option>
                <option value="investor">Outside investor</option>
              </select>
            </Field>
            <Field label="Type">
              <select className={inputCls} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="contribution">Capital contribution (in)</option>
                <option value="drawing">Drawing / redemption (out)</option>
              </select>
            </Field>
            <Field label="Amount"><input type="number" min="0" step="0.01" className={inputCls} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required /></Field>
            <Field label="Date"><input type="date" className={inputCls} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
            <Field label="Notes"><input className={inputCls} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional" /></Field>
            <div className="col-span-1 sm:col-span-2 md:col-span-5 flex justify-end pt-1">
              <button type="submit" className={btnCls}>Save</button>
            </div>
          </form>
        </Panel>
      )}

      <Panel title="Equity log" eyebrow="Every contribution and drawing, most recent first">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: "550px" }}>
            <thead>
              <tr className="text-left chip text-ink-500 uppercase border-b border-ink-700">
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Who</th>
                <th className="py-2 pr-4">Type</th>
                <th className="py-2 pr-4">Notes</th>
                <th className="py-2 pr-4 text-right">Amount</th>
                <th className="py-2 pr-4"></th>
              </tr>
            </thead>
            <tbody>
              {sortByDateDesc(data.equityTransactions, "date").map((t) => (
                <tr key={t.id} className="border-b border-ink-700/60 text-ink-200">
                  <td className="py-2 pr-4 chip">{t.date}</td>
                  <td className="py-2 pr-4">{(t.holder || "owner") === "investor" ? "Investor" : "Owner"}</td>
                  <td className="py-2 pr-4">{t.type === "contribution" ? "Contribution" : "Drawing"}</td>
                  <td className="py-2 pr-4 text-ink-400 text-xs">{t.notes || "—"}</td>
                  <td className="py-2 pr-4 text-right chip">{money(t.amount)}</td>
                  <td className="py-2 pr-4 text-right"><button className="text-ink-500 hover:text-[var(--accent)] text-xs" onClick={async () => { if (await confirmAction("Remove this entry? This can't be undone.", { danger: true, confirmLabel: "Remove" })) remove("equityTransactions", t.id); }}>remove</button></td>
                </tr>
              ))}
              {(data.equityTransactions || []).length === 0 && <tr><td colSpan={6} className="py-6 text-center text-ink-500">No equity transactions logged yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function LoansTab({ data, add, update, remove, confirmAction, money }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blankLoan);
  const [repayDrafts, setRepayDrafts] = useState({});

  const outstanding = (loan) => {
    const repaid = (loan.repayments || []).reduce((s, r) => s + (r.principalPortion || 0), 0);
    return Math.max(0, (loan.principal || 0) - repaid);
  };
  const totalPrincipal = (data.loans || []).reduce((s, l) => s + (l.principal || 0), 0);
  const totalOutstanding = (data.loans || []).reduce((s, l) => s + outstanding(l), 0);
  const totalInterestPaid = (data.loans || []).reduce((s, l) => s + (l.repayments || []).reduce((rs, r) => rs + (r.interestPortion || 0), 0), 0);

  const submit = async (e) => {
    e.preventDefault();
    const record = {
      lender: form.lender,
      principal: parseFloat(form.principal) || 0,
      startDate: form.startDate || new Date().toISOString().slice(0, 10),
      interestRate: parseFloat(form.interestRate) || 0,
      termMonths: parseFloat(form.termMonths) || null,
      notes: form.notes,
      repayments: [],
    };
    const result = await add("loans", record);
    if (result?.ok !== false) {
      await postJournalEntry(add, journalForLoan({ ...record, id: result.id }));
    }
    setForm(blankLoan);
    setOpen(false);
  };

  const updateDraft = (loanId, patch) => setRepayDrafts((d) => ({ ...d, [loanId]: { ...d[loanId], ...patch } }));

  const logRepayment = async (loan) => {
    const draft = repayDrafts[loan.id];
    const principalPortion = parseFloat(draft?.principalPortion) || 0;
    const interestPortion = parseFloat(draft?.interestPortion) || 0;
    if (principalPortion <= 0 && interestPortion <= 0) return;
    const date = draft?.date || new Date().toISOString().slice(0, 10);
    const proceed = await confirmAction(
      `Record a repayment of ${money(principalPortion + interestPortion)} (${money(principalPortion)} principal, ${money(interestPortion)} interest) against this loan?`,
      { confirmLabel: "Confirm" }
    );
    if (!proceed) return;
    const repayments = [...(loan.repayments || []), { date, amount: principalPortion + interestPortion, principalPortion, interestPortion }];
    await update("loans", loan.id, { repayments });
    await postJournalEntry(add, journalForLoanRepayment({ ...loan, repaymentDate: date }, { principalPortion, interestPortion }));
    setRepayDrafts((d) => { const next = { ...d }; delete next[loan.id]; return next; });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-1">
          <div className="bg-ink-800 border border-ink-700 rounded-lg px-5 py-4">
            <div className="chip text-ink-400 uppercase">Total borrowed</div>
            <div className="font-display text-2xl font-semibold text-brass-400 mt-1.5">{money(totalPrincipal)}</div>
          </div>
          <div className="bg-ink-800 border border-ink-700 rounded-lg px-5 py-4">
            <div className="chip text-ink-400 uppercase">Outstanding principal</div>
            <div className="font-display text-2xl font-semibold text-[var(--accent)] mt-1.5">{money(totalOutstanding)}</div>
          </div>
          <div className="bg-ink-800 border border-ink-700 rounded-lg px-5 py-4">
            <div className="chip text-ink-400 uppercase">Interest paid to date</div>
            <div className="font-display text-2xl font-semibold text-ink-50 mt-1.5">{money(totalInterestPaid)}</div>
          </div>
        </div>
        <button className={btnGhostCls} onClick={() => setOpen((o) => !o)}>{open ? "Cancel" : "+ Add loan"}</button>
      </div>

      <p className="text-xs text-ink-500">
        Debt, not equity — a bank loan, a director's loan, or any borrowed money with a repayment
        schedule. Posts as a liability (Loans Payable), not to Owner's/Investor's Equity.
      </p>

      {open && (
        <Panel title="Add a loan" eyebrow="Principal received now; log repayments against it as they happen">
          <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
            <Field label="Lender"><input className={inputCls} value={form.lender} onChange={(e) => setForm({ ...form, lender: e.target.value })} placeholder="e.g. GTBank, Director's loan" required /></Field>
            <Field label="Principal"><input type="number" min="0" step="0.01" className={inputCls} value={form.principal} onChange={(e) => setForm({ ...form, principal: e.target.value })} required /></Field>
            <Field label="Start date"><input type="date" className={inputCls} value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></Field>
            <Field label="Interest rate (annual %)"><input type="number" min="0" step="0.01" className={inputCls} value={form.interestRate} onChange={(e) => setForm({ ...form, interestRate: e.target.value })} /></Field>
            <Field label="Term (months)"><input type="number" min="1" step="1" className={inputCls} value={form.termMonths} onChange={(e) => setForm({ ...form, termMonths: e.target.value })} /></Field>
            <div className="col-span-1 sm:col-span-2 md:col-span-5">
              <Field label="Notes">
                <input className={inputCls} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional" />
              </Field>
            </div>
            <div className="col-span-1 sm:col-span-2 md:col-span-5 flex justify-end pt-1">
              <button type="submit" className={btnCls}>Save</button>
            </div>
          </form>
        </Panel>
      )}

      <Panel title="Loan register" eyebrow="Outstanding balance updates as repayments are logged">
        <div className="space-y-4">
          {(data.loans || []).length === 0 && <p className="text-center text-ink-500 py-6 text-sm">No loans logged yet.</p>}
          {sortByDateDesc(data.loans, "startDate").map((loan) => {
            const draft = repayDrafts[loan.id] || {};
            return (
              <div key={loan.id} className="border border-ink-700 rounded-lg p-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <div className="text-sm font-semibold text-ink-100">{loan.lender}</div>
                    <div className="chip text-ink-500 mt-0.5">
                      {money(loan.principal)} principal · {loan.interestRate || 0}% p.a. · started {loan.startDate}
                      {loan.termMonths ? ` · ${loan.termMonths} mo term` : ""}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="chip text-ink-400 uppercase">Outstanding</div>
                    <div className="font-display text-lg font-semibold text-brass-400">{money(outstanding(loan))}</div>
                  </div>
                  <button className="text-ink-500 hover:text-[var(--accent)] text-xs" onClick={async () => { if (await confirmAction("Remove this loan and its repayment history? This can't be undone.", { danger: true, confirmLabel: "Remove" })) remove("loans", loan.id); }}>remove</button>
                </div>

                {(loan.repayments || []).length > 0 && (
                  <div className="mt-3 text-xs text-ink-400">
                    {(loan.repayments || []).map((r, i) => (
                      <div key={i} className="flex justify-between py-0.5">
                        <span>{r.date} — repayment</span>
                        <span>{money(r.principalPortion)} principal + {money(r.interestPortion)} interest</span>
                      </div>
                    ))}
                  </div>
                )}

                {outstanding(loan) > 0.004 && (
                  <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-ink-700 pt-3">
                    <Field label="Principal portion">
                      <input type="number" min="0" step="0.01" className={inputCls} style={{ width: "9rem" }} value={draft.principalPortion || ""} onChange={(e) => updateDraft(loan.id, { principalPortion: e.target.value })} />
                    </Field>
                    <Field label="Interest portion">
                      <input type="number" min="0" step="0.01" className={inputCls} style={{ width: "9rem" }} value={draft.interestPortion || ""} onChange={(e) => updateDraft(loan.id, { interestPortion: e.target.value })} />
                    </Field>
                    <Field label="Date">
                      <input type="date" className={inputCls} style={{ width: "9rem" }} value={draft.date || ""} onChange={(e) => updateDraft(loan.id, { date: e.target.value })} />
                    </Field>
                    <button className={btnGhostCls} onClick={() => logRepayment(loan)}>Log repayment</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
