import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// If these env vars aren't set, the app falls back to local-storage-only
// mode (see AppContext) rather than crashing — useful for anyone who
// hasn't connected a Supabase project yet.
export const supabaseEnabled = Boolean(url && anonKey);

export const supabase = supabaseEnabled ? createClient(url, anonKey) : null;
