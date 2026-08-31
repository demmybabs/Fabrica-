// Shallow camelCase <-> snake_case conversion for top-level object keys —
// used to translate between the app's JS objects and Postgres column
// names. Nested jsonb content (ingredients, inputs, outputs, items, etc.)
// is left exactly as the app wrote it; Postgres doesn't care about key
// casing inside a jsonb blob, only the column names matter.
export function toSnake(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k.replace(/[A-Z]/g, (m) => "_" + m.toLowerCase())] = v;
  }
  return out;
}

export function toCamel(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k.replace(/_([a-z])/g, (_, c) => c.toUpperCase())] = v;
  }
  return out;
}
