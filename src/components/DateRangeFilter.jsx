const presets = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "All", days: null },
];

export default function DateRangeFilter({ range, setRange }) {
  const applyPreset = (days) => {
    if (days === null) {
      setRange({ from: "", to: "" });
      return;
    }
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);
    setRange({ from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) });
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {presets.map((p) => (
        <button
          key={p.label}
          onClick={() => applyPreset(p.days)}
          className="chip px-2.5 py-1.5 rounded border border-ink-700 text-ink-300 hover:border-rust-500 hover:text-rust-400"
        >
          {p.label}
        </button>
      ))}
      <input
        type="date"
        value={range.from}
        onChange={(e) => setRange({ ...range, from: e.target.value })}
        className="chip bg-ink-800 border border-ink-700 rounded px-2 py-1.5 text-ink-200"
      />
      <span className="text-ink-600 text-xs">to</span>
      <input
        type="date"
        value={range.to}
        onChange={(e) => setRange({ ...range, to: e.target.value })}
        className="chip bg-ink-800 border border-ink-700 rounded px-2 py-1.5 text-ink-200"
      />
    </div>
  );
}
