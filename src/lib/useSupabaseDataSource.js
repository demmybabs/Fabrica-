import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "./supabaseClient";
import { toSnake, toCamel } from "./caseConvert";

// Tables whose rows map 1:1 onto a top-level array in `data`. App-wide
// singletons (branding, currency, segments, etc.) live in app_settings
// and are handled separately below.
const TABLES = {
  suppliers: "suppliers",
  supplyBatches: "supply_batches",
  products: "products",
  productionRuns: "production_runs",
  customers: "customers",
  salesOrders: "sales_orders",
  spoilage: "spoilage",
};

const DEFAULTS = {
  customUnits: {},
  segments: ["Retail", "Wholesale"],
  wholesaleSubCategories: ["Supermarket", "Distributor", "Grocery store", "Pharmacy"],
  themes: {},
  branding: { name: "Fabrica", tagline: "production line control", logoDataUrl: null },
  currency: { code: "NGN", symbol: "₦" },
};

const EMPTY = {
  suppliers: [], supplyBatches: [], products: [], productionRuns: [],
  customers: [], salesOrders: [], spoilage: [], activeRole: "owner",
  ...DEFAULTS,
};

// Supabase-backed data source — every read/write goes to the shared
// database, so every signed-in device sees the same data. Falls back to
// nothing meaningful if supabaseClient.js couldn't build a client; App.jsx
// only mounts this when supabaseEnabled is true.
export function useSupabaseDataSource() {
  const [data, setData] = useState(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const fetchingRef = useRef(false);

  const fetchAll = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const [suppliers, supplyBatches, products, productionRuns, customers, salesOrders, spoilage, settingsRes] = await Promise.all([
        supabase.from("suppliers").select("*"),
        supabase.from("supply_batches").select("*"),
        supabase.from("products").select("*"),
        supabase.from("production_runs").select("*"),
        supabase.from("customers").select("*"),
        supabase.from("sales_orders").select("*"),
        supabase.from("spoilage").select("*"),
        supabase.from("app_settings").select("*").eq("id", 1).single(),
      ]);
      const settings = settingsRes.data ? toCamel(settingsRes.data) : {};
      setData({
        suppliers: (suppliers.data || []).map(toCamel),
        supplyBatches: (supplyBatches.data || []).map(toCamel),
        products: (products.data || []).map(toCamel),
        productionRuns: (productionRuns.data || []).map(toCamel),
        customers: (customers.data || []).map(toCamel),
        salesOrders: (salesOrders.data || []).map(toCamel),
        spoilage: (spoilage.data || []).map(toCamel),
        customUnits: settings.customUnits ?? DEFAULTS.customUnits,
        segments: settings.segments ?? DEFAULTS.segments,
        wholesaleSubCategories: settings.wholesaleSubCategories ?? DEFAULTS.wholesaleSubCategories,
        themes: settings.themes ?? DEFAULTS.themes,
        branding: settings.branding ?? DEFAULTS.branding,
        currency: settings.currency ?? DEFAULTS.currency,
        activeRole: "owner",
      });
    } catch (e) {
      console.error("Fabrica: failed to load data from Supabase", e);
    } finally {
      fetchingRef.current = false;
      setLoaded(true);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Any change from any device — including this one, on another tab —
  // triggers a refetch, which is what actually makes every screen stay
  // in sync across systems.
  useEffect(() => {
    const channel = supabase.channel("fabrica-sync");
    for (const table of [...Object.values(TABLES), "app_settings"]) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, () => fetchAll());
    }
    channel.subscribe();
    return () => supabase.removeChannel(channel);
  }, [fetchAll]);

  const add = async (key, record) => {
    const table = TABLES[key];
    if (!table) return;
    const { data: inserted, error } = await supabase.from(table).insert(toSnake(record)).select().single();
    if (error) { console.error(`Fabrica: insert into ${table} failed`, error); return; }
    setData((d) => ({ ...d, [key]: [...d[key], toCamel(inserted)] }));
    return inserted.id;
  };

  const update = async (key, id, patch) => {
    const table = TABLES[key];
    if (!table) return;
    setData((d) => ({ ...d, [key]: d[key].map((r) => (r.id === id ? { ...r, ...patch } : r)) })); // optimistic
    const { error } = await supabase.from(table).update(toSnake(patch)).eq("id", id);
    if (error) { console.error(`Fabrica: update ${table} failed`, error); fetchAll(); }
  };

  const remove = async (key, id) => {
    const table = TABLES[key];
    if (!table) return;
    setData((d) => ({ ...d, [key]: d[key].filter((r) => r.id !== id) })); // optimistic
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) { console.error(`Fabrica: delete from ${table} failed`, error); fetchAll(); }
  };

  const updateSettings = async (patch) => {
    setData((d) => ({ ...d, ...patch })); // optimistic
    const { error } = await supabase.from("app_settings").update(toSnake(patch)).eq("id", 1);
    if (error) { console.error("Fabrica: settings update failed", error); fetchAll(); }
  };

  const setCustomUnits = (custom) => updateSettings({ customUnits: custom });
  const setActiveRole = () => {
    // Role comes from who's logged in, not a switcher, once Supabase is
    // connected — see Settings, which hides the switcher in this mode.
  };
  const updateTheme = (role, patch) => {
    updateSettings({ themes: { ...data.themes, [role]: { ...(data.themes?.[role] || {}), ...patch } } });
  };
  const addSegment = (name) => {
    if (data.segments.includes(name)) return;
    updateSettings({ segments: [...data.segments, name] });
  };
  const addWholesaleSubCategory = (name) => {
    if (data.wholesaleSubCategories.includes(name)) return;
    updateSettings({ wholesaleSubCategories: [...data.wholesaleSubCategories, name] });
  };
  const setBranding = (patch) => updateSettings({ branding: { ...data.branding, ...patch } });
  const setCurrency = (currency) => updateSettings({ currency });

  const addIngredientToRecipe = (productId, itemName) => {
    const product = data.products.find((p) => p.id === productId);
    if (!product || product.ingredients.some((i) => i.itemName === itemName)) return;
    update("products", productId, { ingredients: [...product.ingredients, { itemName }] });
  };

  const clearAllData = async () => {
    for (const table of Object.values(TABLES)) {
      await supabase.from(table).delete().not("id", "is", null);
    }
    await supabase.from("app_settings").update(toSnake({
      branding: DEFAULTS.branding, currency: DEFAULTS.currency, segments: DEFAULTS.segments,
      wholesaleSubCategories: DEFAULTS.wholesaleSubCategories, customUnits: {}, themes: {},
    })).eq("id", 1);
    fetchAll();
  };

  const resetToSeed = () => {
    alert("Reset to example data isn't available on a shared, live database — use Clear all data instead if you want a blank slate.");
  };

  return {
    data, loaded, add, remove, update, setCustomUnits, setActiveRole, updateTheme,
    addIngredientToRecipe, addSegment, addWholesaleSubCategory, resetToSeed, clearAllData,
    setCurrency, setBranding,
  };
}
