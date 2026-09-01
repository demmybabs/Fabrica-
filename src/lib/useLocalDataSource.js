import { useEffect } from "react";
import { useLocalState } from "./storage";
import { buildSeed, buildEmpty } from "../data/seed";
import { migrateData } from "./migrate";
import { makeId } from "./id";

// Local-storage-only data source — used when no Supabase project is
// connected (see supabaseClient.js). This is the original single-browser
// behavior, kept as a safety net / offline fallback.
export function useLocalDataSource() {
  const [data, setData] = useLocalState("fabrica_data_v4", buildSeed());

  useEffect(() => {
    const migrated = migrateData(data);
    if (migrated !== data) setData(migrated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const add = (key, record) => {
    const id = makeId(key.slice(0, 3));
    setData((d) => ({ ...d, [key]: [...d[key], { id, ...record }] }));
    return { ok: true, id };
  };
  const remove = (key, id) => {
    setData((d) => ({ ...d, [key]: d[key].filter((r) => r.id !== id) }));
    return { ok: true };
  };
  const update = (key, id, patch) => {
    setData((d) => ({ ...d, [key]: d[key].map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
    return { ok: true };
  };
  const setCustomUnits = (custom) => setData((d) => ({ ...d, customUnits: custom }));
  const setActiveRole = (role) => setData((d) => ({ ...d, activeRole: role }));
  const updateTheme = (role, patch) => {
    setData((d) => ({ ...d, themes: { ...d.themes, [role]: { ...(d.themes?.[role] || {}), ...patch } } }));
  };
  const addIngredientToRecipe = (productId, itemName) => {
    setData((d) => ({
      ...d,
      products: d.products.map((p) => {
        if (p.id !== productId) return p;
        if (p.ingredients.some((i) => i.itemName === itemName)) return p;
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

  return {
    data, loaded: true, add, remove, update, setCustomUnits, setActiveRole, updateTheme,
    addIngredientToRecipe, addSegment, addWholesaleSubCategory, resetToSeed, clearAllData,
    setCurrency, setBranding, writeError: null, clearWriteError: () => {},
  };
}
