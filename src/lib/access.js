// Which routes each role can see in the sidebar. This is a UI-level demo
// of role scoping — the real enforcement point is the Supabase row-level
// security policies in src/data/schema.sql, which apply once the app is
// wired to a live backend (see README).
export const ROLE_ACCESS = {
  owner: ["/", "/supply", "/products", "/production", "/inventory", "/sales", "/customers", "/settings"],
  supply: ["/supply"],
  production_inventory: ["/products", "/production", "/inventory"],
  sales_customers: ["/sales", "/customers"],
  customer: ["/customer-portal"],
};

export function canAccess(role, path) {
  return (ROLE_ACCESS[role] || []).includes(path);
}

export function homeFor(role) {
  const paths = ROLE_ACCESS[role] || [];
  return paths[0] || "/";
}
