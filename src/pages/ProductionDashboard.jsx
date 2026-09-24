import { useState } from "react";
import { Link } from "react-router-dom";
import { useApp, useMoney } from "../lib/AppContext";
import { materialLedger, productionRunCosts, productionLosses, runsAwaitingCount, inRange } from "../lib/calc";
import StatCard from "../components/StatCard";
import DateRangeFilter from "../components/DateRangeFilter";
import Panel from "../components/Panel";
import { ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

const sliceColors = ["#D97A3E", "#C9A227", "#4F8862"];

export default function ProductionDashboard() {
  const { data } = useApp();
  const money = useMoney();
  const [range, setRange] = useState({ from: "", to: "" });
  const ledger = materialLedger(data);
  const productById = Object.fromEntries(data.products.map((p) => [p.id, p]));
  const runsInRange = data.productionRuns.filter((r) => inRange(r.date, range.from, range.to));

  let materialTotal = 0, laborTotal = 0, overheadTotal = 0;
  const unitsByProduct = {};
  for (const run of runsInRange) {
    const { materialCost, overheadTotal: oh, outputs } = productionRunCosts(run, ledger, productById);
    materialTotal += materialCost;
    laborTotal += run.laborCost || 0;
    overheadTotal += oh;
    for (const o of outputs) {
      if (!o.isCounted) continue;
      const key = o.productId;
      unitsByProduct[key] = (unitsByProduct[key] || 0) + o.quantity;
    }
  }
  const costSplit = [
    { name: "Materials", value: materialTotal },
    { name: "Labor", value: laborTotal },
    { name: "Overhead", value: overheadTotal },
  ].filter((s) => s.value > 0);

  const topByVolume = Object.entries(unitsByProduct)
    .map(([productId, qty]) => ({ product: productById[productId], qty }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 6);

  const lossRows = productionLosses(data).filter((r) => inRange(r.date, range.from, range.to));
  const totalLossValue = lossRows.reduce((s, r) => s + r.lossValue, 0);
  const totalLossUnits = lossRows.reduce((s, r) => s + r.lossQuantity, 0);
  const awaitingCount = runsAwaitingCount(data);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link to="/production" className="chip text-ink-400 hover:text-[var(--accent)]">← Back to Production</Link>
          <h1 className="font-display text-xl font-semibold text-ink-50 mt-1">Production dashboard</h1>
        </div>
        <DateRangeFilter range={range} setRange={setRange} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Runs logged" value={runsInRange.length} sub="in range" tone="moss" />
        <StatCard label="Total production cost" value={money(materialTotal + laborTotal + overheadTotal)} sub="materials + labor + overhead" tone="brass" />
        <StatCard label="Value lost — production" value={money(totalLossValue)} sub={totalLossUnits > 0 ? `${totalLossUnits} units, in range` : "none in range"} tone="rust" />
        <StatCard label="Awaiting physical count" value={awaitingCount.length} sub="lifetime, not date-filtered" tone="rust" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Panel title="Cost breakdown" eyebrow="Materials vs labor vs overhead, for the range above">
          {costSplit.length === 0 ? <p className="text-ink-500 text-center py-10">No runs in this range yet.</p> : (
            <div style={{ width: "100%", height: 240 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={costSplit} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(e) => `${e.name} ${((e.percent || 0) * 100).toFixed(0)}%`}>
                    {costSplit.map((_, i) => <Cell key={i} fill={sliceColors[i % sliceColors.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#1A2126", border: "1px solid #323D45", fontSize: 12 }} labelStyle={{ color: "#EEF0F1" }} formatter={(v, n) => [money(v), n]} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>

        <Panel title="Top products by volume produced" eyebrow="Counted output only, for the range above">
          {topByVolume.length === 0 ? <p className="text-ink-500 text-center py-10">No counted output in this range yet.</p> : (
            <div style={{ width: "100%", height: 240 }}>
              <ResponsiveContainer>
                <BarChart data={topByVolume.map((r) => ({ name: r.product ? `${r.product.name} · ${r.product.packSize}` : "—", units: r.qty }))} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#323D45" />
                  <XAxis dataKey="name" stroke="#8A959B" fontSize={10} interval={0} angle={-15} textAnchor="end" height={50} />
                  <YAxis stroke="#8A959B" fontSize={11} />
                  <Tooltip contentStyle={{ background: "#1A2126", border: "1px solid #323D45", fontSize: 12 }} labelStyle={{ color: "#EEF0F1" }} formatter={(v) => [v, "Units"]} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="units" name="Units produced" fill="#4F8862" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Production loss log" eyebrow="Units lost during the process itself — distinct from post-production spoilage in Inventory">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left chip text-ink-500 uppercase border-b border-ink-700">
              <th className="py-1.5 pr-4">Date</th>
              <th className="py-1.5 pr-4">Batch</th>
              <th className="py-1.5 pr-4">Product</th>
              <th className="py-1.5 pr-4 text-right">Units lost</th>
              <th className="py-1.5 pr-4 text-right">Value</th>
            </tr>
          </thead>
          <tbody>
            {[...lossRows].reverse().map((r, i) => (
              <tr key={i} className="text-ink-200 border-b border-ink-700/60">
                <td className="py-1.5 pr-4 chip">{r.date}</td>
                <td className="py-1.5 pr-4 chip">{r.batchCode}</td>
                <td className="py-1.5 pr-4">{r.product ? `${r.product.name} · ${r.product.packSize}` : "—"}</td>
                <td className="py-1.5 pr-4 text-right chip">{r.lossQuantity}</td>
                <td className="py-1.5 pr-4 text-right chip text-[var(--accent)]">{money(r.lossValue)}</td>
              </tr>
            ))}
            {lossRows.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-ink-500">No production loss logged in this range.</td></tr>}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
