export default function StatCard({ label, value, sub, tone = "ink" }) {
  const toneMap = {
    ink: "text-ink-50",
    rust: "text-rust-400",
    brass: "text-brass-400",
    moss: "text-moss-400",
  };
  return (
    <div className="bg-ink-800 border border-ink-700 rounded-lg px-5 py-4">
      <div className="chip text-ink-400 uppercase">{label}</div>
      <div className={`font-display text-2xl font-semibold mt-1.5 ${toneMap[tone]}`}>{value}</div>
      {sub && <div className="text-xs text-ink-400 mt-1">{sub}</div>}
    </div>
  );
}
