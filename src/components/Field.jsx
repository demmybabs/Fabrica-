export function Field({ label, children }) {
  return (
    <label className="block">
      <span className="chip text-ink-400 uppercase block mb-1">{label}</span>
      {children}
    </label>
  );
}

export const inputCls =
  "w-full bg-ink-900 border border-ink-700 rounded px-2.5 py-1.5 text-sm text-ink-100 focus:outline-none focus:border-rust-500";

export const btnCls =
  "chip px-3 py-1.5 rounded border border-rust-600 bg-rust-600/20 text-rust-400 hover:bg-rust-600/30";

export const btnGhostCls =
  "chip px-3 py-1.5 rounded border border-ink-700 text-ink-300 hover:border-ink-400";
