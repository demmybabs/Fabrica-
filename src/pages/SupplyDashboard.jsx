import { useState } from "react";
import { Link } from "react-router-dom";
import { useApp, useMoney } from "../lib/AppContext";
import { materialLedger, topMaterialsBySpend, topSuppliersBySpend, expiringBatches, inRange } from "../lib/calc";
import StatCard from "../components/StatCard";
import DateRangeFilter from "../components/DateRangeFilter";
import Panel from "../components/Panel";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

export default function SupplyDashboard() {
  const { data } = useApp();
  const money = useMoney();
  const [range, setRange] = useState({ from: "", to: "" });
  const ledger = materialLedger(data);
  const deliveriesInRange = data.supplyBatches.filter((b) => inRange(b.dateReceived, range.from, range.to));
  const topMaterials = topMaterialsBySpend(data, 6);
  const topSuppliers = topSuppliersBySpend(data, 6);
  const expiring = expiringBatches(data, 30);
  const symbol = data.currency?.symbol || "₦";
  const axisMoney = (v) => {
    const n = Number(v) || 0;
    if (Math.abs(n) >= 1_000_000) return `${symbol}${(n / 1_000_000).toFixed(1)}M`;
    if (Math.abs(n) >= 1_000) return `${symbol}${(n / 1_000).toFixed(1)}K`;
    return `${symbol}${n.toLocaleString()}`;
  };

  const totalReceivedInRange = deliveriesInRange.reduce((s, b) => s + b.totalCost, 0);
  const totalPayable = ledger.reduce((s, r) => s + r.payable, 0);
  const totalValueRemaining = ledger.reduce((s, r) => s + r.valueRemaining, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link to="/supply" className="chip text-ink-400 hover:text-[var(--accent)]">← Back to Supply</Link>
          <h1 className="font-display text-xl font-semibold text-ink-50 mt-1">Supply dashboard</h1>
        </div>
        <DateRangeFilter range={range} setRange={setRange} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Received in range" value={money(totalReceivedInRange)} sub={`${deliveriesInRange.length} deliveries`} tone="moss" />
        <StatCard label="Materials on hand" value={money(totalValueRemaining)} sub="current value" tone="brass" />
        <StatCard label="Payable to suppliers" value={money(totalPayable)} tone="rust" />
        <StatCard label="Expiring within 30 days" value={expiring.length} sub={expiring.some((e) => e.expired) ? "includes already-expired" : "none expired"} tone={expiring.length > 0 ? "rust" : "ink"} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Panel title="Top materials by spend" eyebrow="Lifetime — supply cost is fixed at receipt">
          {topMaterials.length === 0 ? <p className="text-ink-500 text-center py-10">No deliveries yet.</p> : (
            <div style={{ width: "100%", height: 240 }}>
              <ResponsiveContainer>
                <BarChart data={topMaterials.map((m) => ({ name: m.itemName, spend: m.costSupplied }))} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#323D45" />
                  <XAxis dataKey="name" stroke="#8A959B" fontSize={10} interval={0} angle={-15} textAnchor="end" height={50} />
                  <YAxis stroke="#8A959B" fontSize={11} tickFormatter={axisMoney} width={64} />
                  <Tooltip contentStyle={{ background: "#1A2126", border: "1px solid #323D45", fontSize: 12 }} labelStyle={{ color: "#EEF0F1" }} formatter={(v) => [money(v), "Spend"]} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="spend" name="Spend" fill="#D97A3E" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>

        <Panel title="Top suppliers by spend" eyebrow="Lifetime">
          {topSuppliers.length === 0 ? <p className="text-ink-500 text-center py-10">No deliveries yet.</p> : (
            <div style={{ width: "100%", height: 240 }}>
              <ResponsiveContainer>
                <BarChart data={topSuppliers.map((s) => ({ name: s.supplier?.name || "—", spend: s.spend }))} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#323D45" />
                  <XAxis dataKey="name" stroke="#8A959B" fontSize={10} interval={0} angle={-15} textAnchor="end" height={50} />
                  <YAxis stroke="#8A959B" fontSize={11} tickFormatter={axisMoney} width={64} />
                  <Tooltip contentStyle={{ background: "#1A2126", border: "1px solid #323D45", fontSize: 12 }} labelStyle={{ color: "#EEF0F1" }} formatter={(v) => [money(v), "Spend"]} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="spend" name="Spend" fill="#4F8862" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Expiring & expired deliveries" eyebrow="Within 30 days, or already past expiry">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left chip text-ink-500 uppercase border-b border-ink-700">
              <th className="py-1.5 pr-4">Item</th>
              <th className="py-1.5 pr-4">Received</th>
              <th className="py-1.5 pr-4">Expiry</th>
              <th className="py-1.5 pr-4 text-right">Qty</th>
              <th className="py-1.5 pr-4 text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {expiring.map(({ batch, daysLeft, expired }) => (
              <tr key={batch.id} className="text-ink-200 border-b border-ink-700/60">
                <td className="py-1.5 pr-4">{batch.itemName}</td>
                <td className="py-1.5 pr-4 chip">{batch.dateReceived}</td>
                <td className="py-1.5 pr-4 chip">{batch.expiryDate}</td>
                <td className="py-1.5 pr-4 text-right chip">{batch.quantity} {batch.unit}</td>
                <td className={`py-1.5 pr-4 text-right chip ${expired ? "text-red-400" : "text-[var(--accent)]"}`}>
                  {expired ? `expired ${Math.abs(daysLeft)}d ago` : `${daysLeft}d left`}
                </td>
              </tr>
            ))}
            {expiring.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-ink-500">Nothing expiring soon.</td></tr>}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
