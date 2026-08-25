import { useState } from "react";
import { useApp, useMoney } from "../lib/AppContext";
import { allUnits } from "../lib/uom";
import Panel from "../components/Panel";
import { Field, inputCls, btnCls, btnGhostCls } from "../components/Field";

const blankProduct = { name: "", flavor: "", packSize: "", defaultPrice: "", imageDataUrl: null };
const blankIngredient = { itemName: "", quantityPerUnit: "", unit: "kg" };

export default function Products() {
  const { data, add, update, remove } = useApp();
  const money = useMoney();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blankProduct);
  const [ingredients, setIngredients] = useState([{ ...blankIngredient }]);
  const [editingId, setEditingId] = useState(null);
  const [newIngredient, setNewIngredient] = useState({});

  const units = allUnits(data.customUnits);
  const knownMaterials = [...new Set([
    ...data.supplyBatches.map((b) => b.itemName),
    ...data.products.flatMap((p) => p.ingredients.map((i) => i.itemName)),
  ])];

  const updateIngRow = (i, patch) => setIngredients(ingredients.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const onImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({ ...f, imageDataUrl: reader.result }));
    reader.readAsDataURL(file);
  };

  const submit = (e) => {
    e.preventDefault();
    add("products", {
      ...form,
      unit: "unit",
      defaultPrice: parseFloat(form.defaultPrice) || 0,
      ingredients: ingredients
        .filter((i) => i.itemName && i.quantityPerUnit)
        .map((i) => ({ ...i, quantityPerUnit: parseFloat(i.quantityPerUnit) || 0 })),
    });
    setForm(blankProduct);
    setIngredients([{ ...blankIngredient }]);
    setOpen(false);
  };

  const addIngredientToExisting = (product) => {
    const row = newIngredient[product.id];
    if (!row?.itemName || !row?.quantityPerUnit) return;
    update("products", product.id, {
      ingredients: [...product.ingredients, { itemName: row.itemName, quantityPerUnit: parseFloat(row.quantityPerUnit), unit: row.unit || "kg" }],
    });
    setNewIngredient({ ...newIngredient, [product.id]: { itemName: "", quantityPerUnit: "", unit: "kg" } });
  };

  const removeIngredient = (product, itemName) => {
    update("products", product.id, { ingredients: product.ingredients.filter((i) => i.itemName !== itemName) });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="chip text-ink-400 uppercase">Module 02a</div>
          <h1 className="font-display text-xl font-semibold text-ink-50">Products &amp; recipes</h1>
          <p className="text-sm text-ink-400 mt-1 max-w-lg">Define what you make and what goes into it — Production uses this to auto-fill materials for every run.</p>
        </div>
        <button className={btnCls} onClick={() => setOpen((o) => !o)}>{open ? "Cancel" : "+ New product"}</button>
      </div>

      {open && (
        <Panel title="New product" eyebrow="Define it once — production will auto-fill materials from this recipe">
          <form onSubmit={submit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <Field label="Product name"><input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Granola" required /></Field>
              <Field label="Flavor / variant"><input className={inputCls} value={form.flavor} onChange={(e) => setForm({ ...form, flavor: e.target.value })} placeholder="e.g. Spicy" /></Field>
              <Field label="Pack size"><input className={inputCls} value={form.packSize} onChange={(e) => setForm({ ...form, packSize: e.target.value })} placeholder="e.g. 1kg" required /></Field>
              <Field label="Selling price"><input type="number" step="0.01" className={inputCls} value={form.defaultPrice} onChange={(e) => setForm({ ...form, defaultPrice: e.target.value })} placeholder="e.g. 9.50" /></Field>
            </div>
            <Field label="Product image">
              <div className="flex items-center gap-3">
                {form.imageDataUrl && <img src={form.imageDataUrl} alt="" className="w-12 h-12 rounded object-cover border border-ink-700" />}
                <input type="file" accept="image/*" className={inputCls} onChange={onImageChange} />
              </div>
            </Field>
            <div>
              <div className="chip text-ink-400 uppercase mb-2">Recipe — quantity needed per single unit produced</div>
              <div className="space-y-2 overflow-x-auto">
                {ingredients.map((row, i) => (
                  <div key={i} className="grid grid-cols-8 gap-2 items-center min-w-[600px]">
                    <input list="materials" className={`${inputCls} col-span-3`} placeholder="Ingredient" value={row.itemName} onChange={(e) => updateIngRow(i, { itemName: e.target.value })} />
                    <input type="number" step="0.0001" className={`${inputCls} col-span-2`} placeholder="qty / unit" value={row.quantityPerUnit} onChange={(e) => updateIngRow(i, { quantityPerUnit: e.target.value })} />
                    <select className={`${inputCls} col-span-2`} value={row.unit} onChange={(e) => updateIngRow(i, { unit: e.target.value })}>
                      {units.map((u) => <option key={u.unit} value={u.unit}>{u.unit}</option>)}
                    </select>
                    <button type="button" className="text-ink-500 hover:text-[var(--accent)] text-xs" onClick={() => setIngredients(ingredients.filter((_, idx) => idx !== i))}>remove</button>
                  </div>
                ))}
              </div>
              <datalist id="materials">{knownMaterials.map((m) => <option key={m} value={m} />)}</datalist>
              <button type="button" className={`${btnGhostCls} mt-2`} onClick={() => setIngredients([...ingredients, { ...blankIngredient }])}>+ add ingredient</button>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className={btnGhostCls} onClick={() => setOpen(false)}>Cancel</button>
              <button type="submit" className={btnCls}>Save product</button>
            </div>
          </form>
        </Panel>
      )}

      <Panel title="Product catalog" eyebrow="Every recipe on file — edit ingredients inline">
        <div className="space-y-4">
          {data.products.map((product) => (
            <div key={product.id} className="border border-ink-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  {product.imageDataUrl && <img src={product.imageDataUrl} alt="" className="w-10 h-10 rounded object-cover border border-ink-700" />}
                  <div>
                    <span className="font-display text-sm font-semibold text-ink-100">{product.name}</span>
                    <span className="chip text-ink-500 ml-2">{product.flavor} · {product.packSize}</span>
                    <span className="chip text-[var(--accent)] ml-2">{money(product.defaultPrice)}</span>
                  </div>
                </div>
                <button className="text-ink-500 hover:text-[var(--accent)] text-xs" onClick={() => remove("products", product.id)}>remove product</button>
              </div>
              <div className="overflow-x-auto">
<table className="w-full text-sm mb-3" style={{minWidth: "600px"}}>
                <thead>
                  <tr className="text-left chip text-ink-500 uppercase border-b border-ink-700">
                    <th className="py-1.5 pr-4">Ingredient</th>
                    <th className="py-1.5 pr-4 text-right">Qty / unit</th>
                    <th className="py-1.5 pr-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {product.ingredients.map((ing) => (
                    <tr key={ing.itemName} className="text-ink-200">
                      <td className="py-1.5 pr-4">{ing.itemName}</td>
                      <td className="py-1.5 pr-4 text-right chip">{ing.quantityPerUnit} {ing.unit}</td>
                      <td className="py-1.5 pr-4 text-right">
                        <button className="text-ink-500 hover:text-[var(--accent)] text-xs" onClick={() => removeIngredient(product, ing.itemName)}>remove</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
</div>
              <div className="grid grid-cols-8 gap-2 items-center min-w-[600px]">
                <input list="materials" className={`${inputCls} col-span-3`} placeholder="Add ingredient…" value={newIngredient[product.id]?.itemName || ""} onChange={(e) => setNewIngredient({ ...newIngredient, [product.id]: { ...newIngredient[product.id], itemName: e.target.value } })} />
                <input type="number" step="0.0001" className={`${inputCls} col-span-2`} placeholder="qty / unit" value={newIngredient[product.id]?.quantityPerUnit || ""} onChange={(e) => setNewIngredient({ ...newIngredient, [product.id]: { ...newIngredient[product.id], quantityPerUnit: e.target.value } })} />
                <select className={`${inputCls} col-span-2`} value={newIngredient[product.id]?.unit || "kg"} onChange={(e) => setNewIngredient({ ...newIngredient, [product.id]: { ...newIngredient[product.id], unit: e.target.value } })}>
                  {units.map((u) => <option key={u.unit} value={u.unit}>{u.unit}</option>)}
                </select>
                <button type="button" className="chip text-[var(--accent)] text-xs" onClick={() => addIngredientToExisting(product)}>+ add</button>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
