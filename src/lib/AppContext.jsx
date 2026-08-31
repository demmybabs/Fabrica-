import { createContext, useContext } from "react";
import { supabaseEnabled } from "./supabaseClient";
import { useLocalDataSource } from "./useLocalDataSource";
import { useSupabaseDataSource } from "./useSupabaseDataSource";

const AppContext = createContext(null);

export function AppProvider({ children }) {
  // supabaseEnabled is a build-time constant (from env vars), never
  // changes while the app is running, so picking a hook based on it is
  // safe even though it looks conditional.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const source = supabaseEnabled ? useSupabaseDataSource() : useLocalDataSource();

  if (!source.loaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ink-950 text-ink-400">
        <div className="chip">Loading your workspace…</div>
      </div>
    );
  }

  return <AppContext.Provider value={source}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

export function useMoney() {
  const { data } = useApp();
  const symbol = data.currency?.symbol || "₦";
  return (amount) => `${symbol}${(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
