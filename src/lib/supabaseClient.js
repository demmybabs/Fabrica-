import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// If these env vars aren't set, the app falls back to local-storage-only
// mode (see AppContext) rather than crashing — useful for anyone who
// hasn't connected a Supabase project yet.
export const supabaseEnabled = Boolean(url && anonKey);

// PKCE flow: after Google sign-in, Supabase sends the browser back with a
// short ?code=... in the query string. The default flow puts tokens in the
// URL hash instead, which collides with this app's HashRouter.
export const supabase = supabaseEnabled
  ? createClient(url, anonKey, { auth: { flowType: "pkce" } })
  : null;
