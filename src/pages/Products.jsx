import { useState } from "react";
import { useApp } from "../lib/AppContext";
import Panel from "../components/Panel";
import { Field, inputCls, btnCls, btnGhostCls } from "../components/Field";

const blankProduct = { name: "", flavor: "", packSize: "", imageDataUrl: null };

export default function Products() {
  const { data, add, update, remove } = useApp();  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blankProduct);
  const [ingredientNames, setIngredientNames] = useState([""]);
  const [prices, setPrices] = useState({});
  const [newIngredient, setNewIngredient] = useState({});

  const knownMaterials = [...new Set([
    ...data.supplyBatches.map((b) => b.itemName),
    ...data.products.flatMap((p) => p.ingredients.map((i) => i.itemName)),
  ])];

  const onImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({ ...f, imageDataUrl: reader.result }));
    reader.readAsDataURL(file);
  };

  const submit = (e) => {
    e.preventDefault();
    const pricesBySegment = {};
    for (const seg of data.segments) {
      if (prices[seg]) pricesBySegment[seg] = parseFloat(prices[seg]) || 0;
    }
    add("products", {
      ...form,
      unit: "unit",
      pricesBySegment,
      ingredients: ingredientNames.filter((n) => n.trim()).map((n) => ({ itemName: n.trim() })),
    });
    setForm(blankProduct);
    setIngredientNames([""]);
    setPrices({});
    setOpen(false);
  };

  const addIngredientToExisting = (product) => {
    const name = newIngredient[product.id]?.trim();
    if (!name) return;
    if (product.ingredients.some((i) => i.itemName === name)) return;
    update("products", product.id, { ingredients: [...product.ingredients, { itemName: name }] });
    setNewIngredient({ ...newIngredient, [product.id]: "" });
  };

  const removeIngredient = (product, itemName) => {
    update("products", product.id, { ingredients: product.ingredients.filter((i) => i.itemName !== itemName) });
  };

  const updatePrice = (product, segment, value) => {
    update("products", product.id, { pricesBySegment: { ...product.pricesBySegment, [segment]: parseFloat(value) || 0 } });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="chip text-ink-400 uppercase">Module 02a</div>
          <h1 className="font-display text-xl font-semibold text-ink-50">Products &amp; recipes</h1>
          <p className="text-sm text-ink-400 mt-1 max-w-lg">
            Define what you make, which ingredients go into it, and what each customer
            segment pays. Production will use this list to suggest materials for every run,
            and estimate how much of each ingredient actually went into each product.
          </p>
        </div>
        <button className={btnCls} onClick={() => setOpen((o) => !o)}>{open ? "Cancel" : "+ New product"}</button>
      </div>

      {open && (
        <Panel title="New product" eyebrow="List the ingredients it needs — exact quantities are estimated automatically from each production run">
          <form onSubmit={submit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="Product name"><input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Granola" required /></Field>
              <Field label="Flavor / variant"><input className={inputCls} value={form.flavor} onChange={(e) => setForm({ ...form, flavor: e.target.value })} placeholder="e.g. Spicy" /></Field>
              <Field label="Pack size"><input className={inputCls} value={form.packSize} onChange={(e) => setForm({ ...form, packSize: e.target.value })} placeholder="e.g. 1kg" required /></Field>
            </div>
            <Field label="Product image">
              <div className="flex items-center gap-3">
                {form.imageDataUrl && <img src={form.imageDataUrl} alt="" className="w-12 h-12 rounded object-cover border border-ink-700" />}
                <input type="file" accept="image/*" className={inputCls} onChange={onImageChange} />
              </div>
            </Field>

            <div>
              <div className="chip text-ink-400 uppercase mb-2">Selling price per customer segment</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {data.segments.map((seg) => (
                  <Field key={seg} label={`${seg} price (${data.currency?.symbol || "₦"})`}>
                    <input type="number" step="0.01" className={inputCls} value={prices[seg] || ""} onChange={(e) => setPrices({ ...prices, [seg]: e.target.value })} placeholder="0.00" />
                  </Field>
                ))}
              </div>
            </div>

            <div>
              <div className="chip text-ink-400 uppercase mb-2">Ingredients needed</div>
              <div className="space-y-2">
                {ingredientNames.map((name, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input list="materials" className={inputCls} placeholder="Ingredient name" value={name} onChange={(e) => setIngredientNames(ingredientNames.map((n, idx) => (idx === i ? e.target.value : n)))} />
                    <button type="button" className="text-ink-500 hover:text-[var(--accent)] text-xs shrink-0" onClick={() => setIngredientNames(ingredientNames.filter((_, idx) => idx !== i))}>remove</button>
                  </div>
                ))}
              </div>
              <datalist id="materials">{knownMaterials.map((m) => <option key={m} value={m} />)}</datalist>
              <button type="button" className={`${btnGhostCls} mt-2`} onClick={() => setIngredientNames([...ingredientNames, ""])}>+ add ingredient</button>
            </div>

            <div className="flex justify-end gap-2">
              <button type="button" className={btnGhostCls} onClick={() => setOpen(false)}>Cancel</button>
              <button type="submit" className={btnCls}>Save product</button>
            </div>
          </form>
        </Panel>
      )}

      <Panel title="Product catalog" eyebrow="Edit ingredients and per-segment prices inline">
        <div className="space-y-4">
          {data.products.map((product) => (
            <div key={product.id} className="border border-ink-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  {product.imageDataUrl && <img src={product.imageDataUrl} alt="" className="w-10 h-10 rounded object-cover border border-ink-700" />}
                  <div>
                    <span className="font-display text-sm font-semibold text-ink-100">{product.name}</span>
                    <span className="chip text-ink-500 ml-2">{product.flavor} · {product.packSize}</span>
                  </div>
                </div>
                <button className="text-ink-500 hover:text-[var(--accent)] text-xs" onClick={() => remove("products", product.id)}>remove product</button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                {data.segments.map((seg) => (
                  <div key={seg}>
                    <span className="chip text-ink-500 uppercase block mb-1">{seg} price ({data.currency?.symbol || "₦"})</span>
                    <input type="number" step="0.01" className={inputCls} value={product.pricesBySegment?.[seg] ?? ""} onChange={(e) => updatePrice(product, seg, e.target.value)} placeholder="0.00" />
                  </div>
                ))}
              </div>

              <div className="chip text-ink-400 uppercase mb-2">Ingredients</div>
              <div className="flex flex-wrap gap-2 mb-3">
                {product.ingredients.map((ing) => (
                  <span key={ing.itemName} className="chip bg-ink-900 border border-ink-700 rounded px-2 py-1 text-ink-200 flex items-center gap-2">
                    {ing.itemName}
                    <button className="text-ink-500 hover:text-[var(--accent)]" onClick={() => removeIngredient(product, ing.itemName)}>×</button>
                  </span>
                ))}
                {product.ingredients.length === 0 && <span className="text-ink-500 text-sm">No ingredients listed yet.</span>}
              </div>
              <div className="flex gap-2 items-center">
                <input list="materials" className={inputCls} placeholder="Add ingredient…" value={newIngredient[product.id] || ""} onChange={(e) => setNewIngredient({ ...newIngredient, [product.id]: e.target.value })} />
                <button type="button" className="chip text-[var(--accent)] text-xs shrink-0" onClick={() => addIngredientToExisting(product)}>+ add</button>
              </div>
            </div>
          ))}
          {data.products.length === 0 && <p className="text-ink-500 text-center py-6">No products yet — add your first one above.</p>}
        </div>
      </Panel>
    </div>
  );
}
