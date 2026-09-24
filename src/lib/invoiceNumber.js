// Invoice number generation.
//
// Rule (confirmed with the business owner):
//  - A one-word name: first letter + the next consonant that appears
//    after it (e.g. "Akindele" -> A + next consonant "k" -> "AK";
//    "Jendol" -> J + next consonant "n" -> "JN").
//  - A two-or-more-word name: first letter of the first word + first
//    letter of the second word (e.g. "Akindele Juwon" -> "AJ";
//    "MedPlus Pharmacy" -> "MP").
//
// Retail:    {initials}-{DD/MM/YY}                    e.g. AJ-24/09/26
// Wholesale: {storeInitials}-{branchInitials}{DD/MM/YY} e.g. JN-AE24/09/26
//   (store from the customer's name, branch from the customer's branch
//   field — both run through the same rule above)
//
// Note: this reproduces 3 of the 4 worked examples exactly. The 4th
// ("Airport Branch" -> "AP") doesn't fit either stated rule literally —
// "Airport Branch" as two words would be "AB" under this rule. We're
// following the rule as stated rather than that one example; flag it if
// a different result was actually intended.

function isVowel(ch) {
  return "AEIOU".includes(ch.toUpperCase());
}

// Initials for a single name part (a person's name, a store name, or a
// branch name) following the confirmed rule above.
export function nameInitials(namePart) {
  const words = String(namePart || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "XX";

  if (words.length === 1) {
    const letters = words[0].replace(/[^a-zA-Z]/g, "");
    if (!letters) return "XX";
    const first = letters[0].toUpperCase();
    for (let i = 1; i < letters.length; i++) {
      if (!isVowel(letters[i])) return first + letters[i].toUpperCase();
    }
    // All-vowel or single-letter name — nothing to fall back on but the
    // first letter twice, so it's still two characters wide.
    return first + first;
  }

  const a = words[0].replace(/[^a-zA-Z]/g, "")[0] || "X";
  const b = words[1].replace(/[^a-zA-Z]/g, "")[0] || "X";
  return (a + b).toUpperCase();
}

function dateStamp(dateStr) {
  const d = new Date((dateStr || new Date().toISOString().slice(0, 10)) + "T00:00:00");
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
}

// Builds the base invoice number (before checking for same-day
// collisions — see makeUniqueInvoiceNumber below).
export function buildInvoiceNumber(customer, dateStr) {
  const stamp = dateStamp(dateStr);
  if (!customer) return `INV-${stamp}`;
  if (customer.segment === "Wholesale") {
    const store = nameInitials(customer.name);
    const branch = nameInitials(customer.branch || customer.subCategory || "");
    return `${store}-${branch}${stamp}`;
  }
  return `${nameInitials(customer.name)}-${stamp}`;
}

// The base rule alone would give two same-day orders for the same
// customer an identical invoice number. This appends "-2", "-3", etc.
// the first time that would happen, so every invoice number stays unique
// without changing the format for the common case (one sale per customer
// per day).
export function makeUniqueInvoiceNumber(customer, dateStr, existingNumbers) {
  const base = buildInvoiceNumber(customer, dateStr);
  const taken = new Set((existingNumbers || []).filter(Boolean));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}
