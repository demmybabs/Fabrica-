import { createContext, useContext, useState, useCallback } from "react";

const ConfirmContext = createContext(null);

// Replaces the browser's native confirm()/alert(). The native dialogs have
// a real failure mode: after several in a row, browsers offer a "prevent
// this page from creating more dialogs" checkbox — if that gets checked,
// every future confirmation on the page silently auto-cancels, with
// nothing telling the person it happened. A dialog rendered inside the
// app itself can't be suppressed that way.
export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);

  const confirmAction = useCallback((message, opts = {}) => {
    return new Promise((resolve) => {
      setState({ message, resolve, danger: opts.danger ?? false, confirmLabel: opts.confirmLabel || "Confirm", requireTyped: opts.requireTyped || null });
    });
  }, []);

  const notify = useCallback((message) => {
    return new Promise((resolve) => {
      setState({ message, resolve, isNotice: true, confirmLabel: "OK" });
    });
  }, []);

  const resolveWith = (result) => {
    state?.resolve(result);
    setState(null);
  };

  return (
    <ConfirmContext.Provider value={{ confirmAction, notify }}>
      {children}
      {state && <ConfirmModal state={state} onResolve={resolveWith} />}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx.confirmAction;
}

export function useNotify() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useNotify must be used within ConfirmProvider");
  return ctx.notify;
}

function ConfirmModal({ state, onResolve }) {
  const [typed, setTyped] = useState("");
  const canConfirm = !state.requireTyped || typed === state.requireTyped;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" onClick={() => !state.isNotice && onResolve(false)}>
      <div className="bg-ink-800 border border-ink-700 rounded-lg p-5 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm text-ink-100 whitespace-pre-line leading-relaxed">{state.message}</p>
        {state.requireTyped && (
          <input
            className="w-full mt-3 bg-ink-900 border border-ink-700 rounded px-2.5 py-1.5 text-sm text-ink-100 focus:outline-none focus:border-red-400"
            placeholder={`Type "${state.requireTyped}" to confirm`}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoFocus
          />
        )}
        <div className="flex justify-end gap-2 mt-4">
          {!state.isNotice && (
            <button className="chip px-3 py-1.5 rounded border border-ink-700 text-ink-300 hover:border-ink-400" onClick={() => onResolve(false)}>Cancel</button>
          )}
          <button
            disabled={!canConfirm}
            autoFocus={state.isNotice}
            className={`chip px-3 py-1.5 rounded border disabled:opacity-40 ${
              state.danger ? "border-red-400 text-red-400 hover:bg-red-400/10" : "border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)]/10"
            }`}
            onClick={() => onResolve(true)}
          >
            {state.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
