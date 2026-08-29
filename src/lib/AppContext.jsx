import { createContext, useContext, useEffect } from "react";
import { useLocalState } from "./storage";
import { buildSeed, buildEmpty, DEFAULT_THEMES } from "../data/seed";
import { migrateData } from "./migrate";
import { makeId } from "./id";

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [data, setData] = useLocalState("fabrica_data_v4", buildSeed());

  // One-time, non-destructive upgrade of data saved by an earlier version —
  // adds new fields with safe defaults, never removes or overwrites
  // anything that's already there. See migrate.js.
  useEffect(() => {
    const migrated = migrateData(data);
    if (migrated !== data) setData(migrated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const add = (key, record) => {
    const id = makeId(key.slice(0, 3));
    setData((d) => ({ ...d, [key]: [...d[key], { id, ...record }] }));
    return id;
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
  const setActiveRole = (role) => {
    setData((d) => ({ ...d, activeRole: role }));
  };
  const updateTheme = (role, patch) => {
    setData((d) => ({ ...d, themes: { ...d.themes, [role]: { ...(d.themes?.[role] || DEFAULT_THEMES[role]), ...patch } } }));
  };
  const addIngredientToRecipe = (productId, itemName) => {
    setData((d) => ({
      ...d,
      products: d.products.map((p) => {
        if (p.id !== productId) return p;
        const exists = p.ingredients.some((i) => i.itemName === itemName);
        if (exists) return p;
        return { ...p, ingredients: [...p.ingredients, { itemName }] };
      }),
    }));
  };
  const addSegment = (name) => {
    setData((d) => (d.segments.includes(name) ? d : { ...d, segments: [...d.segments, name] }));
  };
  const addWholesaleSubCategory = (name) => {
    setData((d) => (d.wholesaleSubCategories.includes(name) ? d : { ...d, wholesaleSubCategories: [...d.wholesaleSubCategories, name] }));
  };
  const resetToSeed = () => setData(buildSeed());
  const clearAllData = () => setData(buildEmpty());
  const setCurrency = (currency) => setData((d) => ({ ...d, currency }));
  const setBranding = (patch) => setData((d) => ({ ...d, branding: { ...d.branding, ...patch } }));

  return (
    <AppContext.Provider
      value={{ data, add, remove, update, setCustomUnits, setActiveRole, updateTheme, addIngredientToRecipe, addSegment, addWholesaleSubCategory, resetToSeed, clearAllData, setCurrency, setBranding }}
    >
      {children}
    </AppContext.Provider>
  );
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
