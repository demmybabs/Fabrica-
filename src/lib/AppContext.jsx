import { createContext, useContext } from "react";
import { useLocalState } from "./storage";
import { buildSeed, DEFAULT_THEMES } from "../data/seed";
import { makeId } from "./id";

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [data, setData] = useLocalState("fabrica_data_v2", buildSeed());

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
  const addIngredientToRecipe = (productId, ingredient) => {
    setData((d) => ({
      ...d,
      products: d.products.map((p) => {
        if (p.id !== productId) return p;
        const exists = p.ingredients.some((i) => i.itemName === ingredient.itemName);
        if (exists) return p;
        return { ...p, ingredients: [...p.ingredients, ingredient] };
      }),
    }));
  };
  const resetToSeed = () => setData(buildSeed());

  return (
    <AppContext.Provider
      value={{ data, add, remove, update, setCustomUnits, setActiveRole, updateTheme, addIngredientToRecipe, resetToSeed }}
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
