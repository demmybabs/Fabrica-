import { useState } from "react";
import { useApp, useMoney } from "../lib/AppContext";
import { overviewMetrics, materialLedger, finishedGoodsInventory, salesWithMargin, inRange } from "../lib/calc";
import StatCard from "../components/StatCard";
import DateRangeFilter from "../components/DateRangeFilter";
import Panel from "../components/Panel";

export default function Overview() {
  const { data } = useApp();
  const money = useMoney();
  const [range, setRange] = useState({ from: "", to: "" });
  const m = overviewMetrics(data, range);
  const ledger = materialLedger(data);
  const inv = finishedGoodsInventory(data);
  const salesInRange = salesWithMargin(data).filter((s) => inRange(s.date, range.from, range.to));

  const rawValue = ledger.reduce((s, r) => s + r.valueRemaining, 0);
  const finishedValue = inv.reduce((s, r) => s + r.valueOnHand, 0);

  const stages = [
    { label: "Supply", value: money(ledger.reduce((s, r) => s + r.costSupplied, 0)), sub: "total received", tone: "rust" },
    { label: "Production", value: data.productionRuns.length, sub: "runs logged", tone: "rust" },
    { label: "Inventory", value: money(rawValue + finishedValue), sub: "value on hand", tone: "brass" },
    { label: "Sales", value: money(m.totalRevenue), sub: "in range", tone: "moss" },
    { label: "Customers", value: m.activeCustomers, sub: "active in range", tone: "moss" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="chip text-ink-400 uppercase">Module 00</div>
          <h1 className="font-display text-xl font-semibold text-ink-50">Overview</h1>
        </div>
        <DateRangeFilter range={range} setRange={setRange} />
      </div>

      {/* Signature element: the flow strip — one line showing how value moves stage to stage */}
      <div className="bg-ink-800 border border-ink-700 rounded-lg p-5 overflow-x-auto">
        <div className="chip text-ink-400 uppercase mb-3">Line flow, at a glance</div>
        <div className="flex items-stretch gap-0 min-w-[820px]">
          {stages.map((s, i) => (
            <div key={s.label} className="flex items-stretch">
              <div className="w-40 flex flex-col justify-center px-4 py-3 border border-ink-700 rounded-lg bg-ink-900">
                <span className="chip text-ink-500 uppercase">{s.label}</span>
                <span className={`font-display text-lg font-semibold mt-1 ${
                  s.tone === "rust" ? "text-rust-400" : s.tone === "brass" ? "text-brass-400" : "text-moss-400"
                }`}>{s.value}</span>
                <span className="text-[11px] text-ink-500 mt-0.5">{s.sub}</span>
              </div>
              {i < stages.length - 1 && (
                <div className="flex items-center px-2 text-ink-600">→</div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Revenue in range" value={money(m.totalRevenue)} tone="moss" />
        <StatCard label="Cost of goods sold" value={money(m.totalCogs)} tone="rust" />
        <StatCard label="Gross profit" value={money(m.grossProfit)} sub={`${m.grossMarginPct.toFixed(1)}% margin`} tone="brass" />
        <StatCard label="Inventory value" value={money(m.inventoryValue)} sub="raw + finished, current" />
        <StatCard label="Payables to suppliers" value={money(m.payables)} tone="rust" />
        <StatCard label="Units sold" value={m.unitsSold} sub={`${m.orderCount} orders`} />
        <StatCard label="Active customers" value={m.activeCustomers} sub="purchased in range" tone="moss" />
        <StatCard label="Production runs" value={data.productionRuns.length} sub="lifetime" />
      </div>

      <Panel title="Recent sales" eyebrow="Feed">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left chip text-ink-500 uppercase border-b border-ink-700">
              <th className="py-2 pr-4">Date</th>
              <th className="py-2 pr-4">Customer</th>
              <th className="py-2 pr-4">SKU</th>
              <th className="py-2 pr-4 text-right">Qty</th>
              <th className="py-2 pr-4 text-right">Revenue</th>
              <th className="py-2 pr-4 text-right">Margin</th>
            </tr>
          </thead>
          <tbody>
            {salesInRange.slice(-8).reverse().map((s) => (
              <tr key={s.id} className="border-b border-ink-700/60 text-ink-200">
                <td className="py-2 pr-4 chip">{s.date}</td>
                <td className="py-2 pr-4">{s.customer?.name || "—"}</td>
                <td className="py-2 pr-4">{s.product ? `${s.product.name} · ${s.product.packSize}` : "—"}</td>
                <td className="py-2 pr-4 text-right chip">{s.quantity}</td>
                <td className="py-2 pr-4 text-right chip">{money(s.revenue)}</td>
                <td className="py-2 pr-4 text-right chip text-moss-400">{money(s.margin)}</td>
              </tr>
            ))}
            {salesInRange.length === 0 && (
              <tr><td colSpan={6} className="py-6 text-center text-ink-500">No sales in this range.</td></tr>
            )}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
