import { useState } from "react";
import { Link } from "react-router-dom";
import { useApp, useMoney } from "../lib/AppContext";
import { overviewMetrics, salesTrend, topProducts, paymentModeBreakdown, givingSummary, debtorsList, openSaleOrReturnOrders } from "../lib/calc";
import StatCard from "../components/StatCard";
import DateRangeFilter from "../components/DateRangeFilter";
import Panel from "../components/Panel";
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

const chartColors = { revenue: "#D97A3E", grossProfit: "#4F8862", units: "#C9A227" };

export default function SalesDashboard() {
  const { data } = useApp();
  const money = useMoney();
  const [range, setRange] = useState({ from: "", to: "" });
  const m = overviewMetrics(data, range);
  const trend = salesTrend(data, range, "monthly");
  const byRevenue = topProducts(data, range, "revenue", 5);
  const byUnits = topProducts(data, range, "quantity", 5);
  const paymentModes = paymentModeBreakdown(data, range);
  const giving = givingSummary(data, range);
  const debtors = debtorsList(data);
  const openSOR = openSaleOrReturnOrders(data);
  const symbol = data.currency?.symbol || "₦";
  const axisMoney = (v) => {
    const n = Number(v) || 0;
    if (Math.abs(n) >= 1_000_000) return `${symbol}${(n / 1_000_000).toFixed(1)}M`;
    if (Math.abs(n) >= 1_000) return `${symbol}${(n / 1_000).toFixed(1)}K`;
    return `${symbol}${n.toLocaleString()}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link to="/sales" className="chip text-ink-400 hover:text-[var(--accent)]">← Back to Sales</Link>
          <h1 className="font-display text-xl font-semibold text-ink-50 mt-1">Sales dashboard</h1>
        </div>
        <DateRangeFilter range={range} setRange={setRange} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Revenue" value={money(m.totalRevenue)} sub={`${m.orderCount} orders`} tone="moss" />
        <StatCard label="Units sold" value={m.unitsSold.toLocaleString()} tone="moss" />
        <StatCard label="Gross profit" value={money(m.grossProfit)} sub={`${m.grossMarginPct.toFixed(1)}% margin`} tone="brass" />
        <StatCard label="VAT collected" value={money(m.vatCollected)} />
        <StatCard label="Receivables outstanding" value={money(m.receivables)} sub={m.onCredit > 0 ? `${money(m.onCredit)} on credit` : undefined} tone="rust" />
        <StatCard label="Sale or Return — open" value={money(m.saleOrReturnOpenValue)} sub={openSOR.length > 0 ? `${openSOR.length} order${openSOR.length === 1 ? "" : "s"} not yet closed` : "none open"} tone={m.saleOrReturnOpenValue > 0 ? "rust" : "ink"} />
        <StatCard label="Given away (ad / charity)" value={`${giving.units.toLocaleString()} units`} sub={giving.value > 0 ? `${money(giving.value)} in cost` : "none in range"} />
        <StatCard label="Active customers" value={m.activeCustomers} tone="moss" />
        <StatCard label="Avg order value" value={money(m.orderCount > 0 ? m.totalRevenue / m.orderCount : 0)} />
      </div>

      <Panel title="Revenue & gross profit over time" eyebrow="Monthly, for the range above">
        {trend.length === 0 ? (
          <p className="text-ink-500 text-center py-10">No sales in this range yet.</p>
        ) : (
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <LineChart data={trend} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#323D45" />
                <XAxis dataKey="label" stroke="#8A959B" fontSize={11} />
                <YAxis stroke="#8A959B" fontSize={11} tickFormatter={axisMoney} width={64} />
                <Tooltip contentStyle={{ background: "#1A2126", border: "1px solid #323D45", fontSize: 12 }} labelStyle={{ color: "#EEF0F1" }} formatter={(v, n) => [money(v), n]} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="revenue" name="Revenue" stroke={chartColors.revenue} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="grossProfit" name="Gross profit" stroke={chartColors.grossProfit} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Panel>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Panel title="Top products by revenue" eyebrow="For the range above">
          {byRevenue.length === 0 ? <p className="text-ink-500 text-center py-10">No sales yet.</p> : (
            <div style={{ width: "100%", height: 220 }}>
              <ResponsiveContainer>
                <BarChart data={byRevenue.map((r) => ({ name: r.product ? `${r.product.name} · ${r.product.packSize}` : "—", revenue: r.revenue }))} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#323D45" />
                  <XAxis dataKey="name" stroke="#8A959B" fontSize={10} interval={0} angle={-15} textAnchor="end" height={50} />
                  <YAxis stroke="#8A959B" fontSize={11} tickFormatter={axisMoney} width={64} />
                  <Tooltip contentStyle={{ background: "#1A2126", border: "1px solid #323D45", fontSize: 12 }} labelStyle={{ color: "#EEF0F1" }} formatter={(v) => [money(v), "Revenue"]} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="revenue" name="Revenue" fill={chartColors.revenue} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>

        <Panel title="Payment modes" eyebrow="Amount recorded per mode, for the range above">
          {paymentModes.length === 0 ? <p className="text-ink-500 text-center py-10">No sales yet.</p> : (
            <div style={{ width: "100%", height: 220 }}>
              <ResponsiveContainer>
                <BarChart data={paymentModes} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#323D45" />
                  <XAxis dataKey="mode" stroke="#8A959B" fontSize={11} />
                  <YAxis stroke="#8A959B" fontSize={11} tickFormatter={axisMoney} width={64} />
                  <Tooltip contentStyle={{ background: "#1A2126", border: "1px solid #323D45", fontSize: 12 }} labelStyle={{ color: "#EEF0F1" }} formatter={(v) => [money(v), "Amount"]} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="amount" name="Amount" fill={chartColors.units} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Top products by units sold" eyebrow="For the range above">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left chip text-ink-500 uppercase border-b border-ink-700">
              <th className="py-1.5 pr-4">Product</th>
              <th className="py-1.5 pr-4 text-right">Units</th>
              <th className="py-1.5 pr-4 text-right">Revenue</th>
              <th className="py-1.5 pr-4 text-right">Margin</th>
            </tr>
          </thead>
          <tbody>
            {byUnits.map((r) => (
              <tr key={r.product?.id} className="text-ink-200 border-b border-ink-700/60">
                <td className="py-1.5 pr-4">{r.product ? `${r.product.name} · ${r.product.packSize}` : "—"}</td>
                <td className="py-1.5 pr-4 text-right chip">{r.quantity.toLocaleString()}</td>
                <td className="py-1.5 pr-4 text-right chip">{money(r.revenue)}</td>
                <td className="py-1.5 pr-4 text-right chip text-moss-400">{money(r.margin)}</td>
              </tr>
            ))}
            {byUnits.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-ink-500">No sales yet.</td></tr>}
          </tbody>
        </table>
      </Panel>

      <Panel title="Debtors" eyebrow="Every order still owing money, most urgent first — due automatically once the due date arrives, Overdue more than 5 days past it">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="text-left chip text-ink-500 uppercase border-b border-ink-700">
                <th className="py-1.5 pr-4">Customer</th>
                <th className="py-1.5 pr-4">Invoice</th>
                <th className="py-1.5 pr-4 text-right">Owed</th>
                <th className="py-1.5 pr-4">Due</th>
                <th className="py-1.5 pr-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {debtors.map((d) => (
                <tr key={d.order.id} className="text-ink-200 border-b border-ink-700/60">
                  <td className="py-1.5 pr-4">{d.customerName}</td>
                  <td className="py-1.5 pr-4 chip text-ink-500">{d.invoiceNumber || "—"}</td>
                  <td className="py-1.5 pr-4 text-right chip text-[var(--accent)]">{money(d.balance)}</td>
                  <td className="py-1.5 pr-4 chip">{d.dueDate}</td>
                  <td className="py-1.5 pr-4">
                    <span className={`chip px-2 py-0.5 rounded border ${
                      d.status === "overdue" ? "border-red-400/50 text-red-400" :
                      d.status === "due" ? "border-[var(--accent)]/50 text-[var(--accent)]" :
                      "border-ink-700 text-ink-400"
                    }`}>
                      {d.status === "overdue" ? "Overdue" : d.status === "due" ? "Due" : "Not yet due"}
                    </span>
                  </td>
                </tr>
              ))}
              {debtors.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-ink-500">No open receivables — everyone's paid up.</td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Sale or Return — open" eyebrow="Goods out on consignment, not yet billed — closing one records what was kept vs. returned">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="text-left chip text-ink-500 uppercase border-b border-ink-700">
                <th className="py-1.5 pr-4">Customer</th>
                <th className="py-1.5 pr-4 text-right">Value</th>
                <th className="py-1.5 pr-4 text-right">Products</th>
                <th className="py-1.5 pr-4">Date</th>
                <th className="py-1.5 pr-4">Returned so far</th>
              </tr>
            </thead>
            <tbody>
              {openSOR.map((r) => (
                <tr key={r.order.id} className="text-ink-200 border-b border-ink-700/60">
                  <td className="py-1.5 pr-4">{r.customerName}</td>
                  <td className="py-1.5 pr-4 text-right chip text-[var(--accent)]">{money(r.value)}</td>
                  <td className="py-1.5 pr-4 text-right chip">{r.productCount}</td>
                  <td className="py-1.5 pr-4 chip">{r.date}</td>
                  <td className="py-1.5 pr-4 chip">{r.anyReturned ? "Yes" : "No"}</td>
                </tr>
              ))}
              {openSOR.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-ink-500">No open Sale-or-Return orders.</td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
