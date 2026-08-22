export default function Panel({ title, eyebrow, actions, children }) {
  return (
    <div className="bg-ink-800 border border-ink-700 rounded-lg overflow-hidden">
      {(title || actions) && (
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-ink-700">
          <div>
            {eyebrow && <div className="chip text-ink-400 uppercase mb-0.5">{eyebrow}</div>}
            {title && <h2 className="font-display text-sm font-semibold text-ink-100">{title}</h2>}
          </div>
          {actions}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}
