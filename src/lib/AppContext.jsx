import { createContext, useContext } from "react";
import { useLocalState } from "./storage";
import { buildSeed } from "../data/seed";
import { makeId } from "./id";

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [data, setData] = useLocalState("fabrica_data_v1", buildSeed());

  const add = (key, record) => {
    setData((d) => ({ ...d, [key]: [...d[key], { id: makeId(key.slice(0, 3)), ...record }] }));
  };
  const remove = (key, id) => {
    setData((d) => ({ ...d, [key]: d[key].filter((r) => r.id !== id) }));
  };
  const update = (key, id, patch) => {
    setData((d) => ({ ...d, [key]: d[key].map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
  };
  const setCustomUnits = (custom) => {
    setData((d) => ({ ...d, customUnits: custom }));
  };
  const resetToSeed = () => setData(buildSeed());

  return (
    <AppContext.Provider value={{ data, add, remove, update, setCustomUnits, resetToSeed }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
