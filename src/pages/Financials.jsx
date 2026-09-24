import { useState } from "react";
import { useApp, useMoney } from "../lib/AppContext";
import { useConfirm } from "../lib/ConfirmContext";
import { postJournalEntry, journalForExpense, journalForFixedAsset, journalForEquity } from "../lib/ledger";
import { accumulatedDepreciationAsOf, incomeStatement, balanceSheet, cashFlowStatement } from "../lib/financials";
import Panel from "../components/Panel";
import { Field, inputCls, btnCls, btnGhostCls } from "../components/Field";

const expenseCategories = ["Rent", "Salaries & wages", "Utilities", "Transport & logistics", "Marketing", "Professional fees", "Repairs & maintenance", "Insurance", "Bank charges", "Other"];
const blankExpense = { date: "", category: expenseCategories[0], description: "", amount: "", amountPaid: "" };
const blankAsset = { name: "", category: "", cost: "", purchaseDate: "", usefulLifeYears: "5", notes: "" };
const blankEquity = { date: "", type: "contribution", amount: "", notes: "" };

const tabs = [
  { key: "statements", label: "Statements" },
  { key: "expenses", label: "Operating expenses" },
  { key: "assets", label: "Fixed assets" },
  { key: "equity", label: "Owner's equity" },
];

export default function Financials() {
  const { data, add, remove } = useApp();
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
            Operating expenses, fixed assets, and owner's equity feed the ledger behind the Income
            Statement, Balance Sheet, and Cash Flow Statement.
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

      {tab === "statements" && <StatementsTab data={data} money={money} />}
      {tab === "expenses" && <ExpensesTab data={data} add={add} remove={remove} confirmAction={confirmAction} money={money} />}
      {tab === "assets" && <AssetsTab data={data} add={add} remove={remove} confirmAction={confirmAction} money={money} />}
      {tab === "equity" && <EquityTab data={data} add={add} remove={remove} confirmAction={confirmAction} money={money} />}
    </div>
  );
}

const startOfMonth = (d) => `${d.slice(0, 7)}-01`;
const todayStr = () => new Date().toISOString().slice(0, 10);

function StatementsTab({ data, money }) {
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

      <IncomeStatementPanel income={income} money={money} />
      <BalanceSheetPanel balance={balance} money={money} />
      <CashFlowPanel cashFlow={cashFlow} money={money} />
    </div>
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
          <div className="chip text-ink-400 uppercase mb-1">Assets</div>
          <Row label="Cash & Bank" value={money(balance.assets.cashAndBank)} />
          <Row label="Accounts receivable" value={money(balance.assets.accountsReceivable)} />
          <Row label="Inventory — raw materials" value={money(balance.assets.inventoryRawMaterials)} />
          <Row label="Inventory — finished goods" value={money(balance.assets.inventoryFinishedGoods)} />
          <Row label="Fixed assets, at cost" value={money(balance.assets.fixedAssetsCost)} />
          <Row label="Accumulated depreciation" value={`(${money(balance.assets.accumulatedDepreciation)})`} indent />
          <Row label="Total assets" value={money(balance.assets.total)} strong divider />
        </div>
        <div>
          <div className="chip text-ink-400 uppercase mb-1">Liabilities</div>
          <Row label="Accounts payable" value={money(balance.liabilities.accountsPayable)} />
          <Row label="VAT payable" value={money(balance.liabilities.vatPayable)} />
          <Row label="Accrued expenses" value={money(balance.liabilities.accruedExpenses)} />
          <Row label="Total liabilities" value={money(balance.liabilities.total)} strong divider />

          <div className="chip text-ink-400 uppercase mb-1 mt-4">Equity</div>
          <Row label="Owner's capital" value={money(balance.equity.ownersCapital)} />
          <Row label="Owner's drawings" value={`(${money(balance.equity.ownersDrawings)})`} indent />
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

function ExpensesTab({ data, add, remove, confirmAction, money }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blankExpense);

  const total = (data.operatingExpenses || []).reduce((s, e) => s + (e.amount || 0), 0);
  const totalPaid = (data.operatingExpenses || []).reduce((s, e) => s + (e.amountPaid || 0), 0);

  const submit = async (e) => {
    e.preventDefault();
    const record = {
      date: form.date || new Date().toISOString().slice(0, 10),
      category: form.category,
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
              <select className={inputCls} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {expenseCategories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
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
              {[...(data.operatingExpenses || [])].reverse().map((ex) => (
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
              {[...(data.fixedAssets || [])].reverse().map((a) => {
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

  const contributions = (data.equityTransactions || []).filter((t) => t.type === "contribution").reduce((s, t) => s + (t.amount || 0), 0);
  const drawings = (data.equityTransactions || []).filter((t) => t.type === "drawing").reduce((s, t) => s + (t.amount || 0), 0);

  const submit = async (e) => {
    e.preventDefault();
    const record = {
      date: form.date || new Date().toISOString().slice(0, 10),
      type: form.type,
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-1">
          <div className="bg-ink-800 border border-ink-700 rounded-lg px-5 py-4">
            <div className="chip text-ink-400 uppercase">Capital contributed</div>
            <div className="font-display text-2xl font-semibold text-brass-400 mt-1.5">{money(contributions)}</div>
          </div>
          <div className="bg-ink-800 border border-ink-700 rounded-lg px-5 py-4">
            <div className="chip text-ink-400 uppercase">Drawings</div>
            <div className="font-display text-2xl font-semibold text-[var(--accent)] mt-1.5">{money(drawings)}</div>
          </div>
          <div className="bg-ink-800 border border-ink-700 rounded-lg px-5 py-4">
            <div className="chip text-ink-400 uppercase">Net owner's equity</div>
            <div className="font-display text-2xl font-semibold text-ink-50 mt-1.5">{money(contributions - drawings)}</div>
          </div>
        </div>
        <button className={btnGhostCls} onClick={() => setOpen((o) => !o)}>{open ? "Cancel" : "+ Log contribution / drawing"}</button>
      </div>

      {open && (
        <Panel title="Log a capital contribution or drawing" eyebrow="Money the owner puts into the business, or takes out of it">
          <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <Field label="Type">
              <select className={inputCls} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="contribution">Owner's capital contribution (in)</option>
                <option value="drawing">Owner's drawing (out)</option>
              </select>
            </Field>
            <Field label="Amount"><input type="number" min="0" step="0.01" className={inputCls} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required /></Field>
            <Field label="Date"><input type="date" className={inputCls} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
            <Field label="Notes"><input className={inputCls} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional" /></Field>
            <div className="col-span-1 sm:col-span-2 md:col-span-4 flex justify-end pt-1">
              <button type="submit" className={btnCls}>Save</button>
            </div>
          </form>
        </Panel>
      )}

      <Panel title="Equity log" eyebrow="Every contribution and drawing, most recent first">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: "500px" }}>
            <thead>
              <tr className="text-left chip text-ink-500 uppercase border-b border-ink-700">
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Type</th>
                <th className="py-2 pr-4">Notes</th>
                <th className="py-2 pr-4 text-right">Amount</th>
                <th className="py-2 pr-4"></th>
              </tr>
            </thead>
            <tbody>
              {[...(data.equityTransactions || [])].reverse().map((t) => (
                <tr key={t.id} className="border-b border-ink-700/60 text-ink-200">
                  <td className="py-2 pr-4 chip">{t.date}</td>
                  <td className="py-2 pr-4">{t.type === "contribution" ? "Contribution" : "Drawing"}</td>
                  <td className="py-2 pr-4 text-ink-400 text-xs">{t.notes || "—"}</td>
                  <td className="py-2 pr-4 text-right chip">{money(t.amount)}</td>
                  <td className="py-2 pr-4 text-right"><button className="text-ink-500 hover:text-[var(--accent)] text-xs" onClick={async () => { if (await confirmAction("Remove this entry? This can't be undone.", { danger: true, confirmLabel: "Remove" })) remove("equityTransactions", t.id); }}>remove</button></td>
                </tr>
              ))}
              {(data.equityTransactions || []).length === 0 && <tr><td colSpan={5} className="py-6 text-center text-ink-500">No equity transactions logged yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
