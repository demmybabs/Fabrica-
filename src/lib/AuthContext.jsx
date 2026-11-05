import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase, supabaseEnabled } from "./supabaseClient";

const AuthContext = createContext(null);

const ACTIVE_ORG_KEY = "fabrica_active_org";
const RESET_FLAG_KEY = "fabrica_password_reset";

function appUrl() {
  // Come back to the same page the app is served from (localhost, the
  // Vercel domain, or a Vercel preview deployment).
  return window.location.origin + window.location.pathname;
}

// Everything about "who is signed in and which organisation are they in".
//
//  - session / user ........ the Supabase login (Google or email+password)
//  - access ................ null while loading, else
//                            { isSuperAdmin, memberships: [{ orgId, role, org }] }
//  - activeOrg ............. the organisation whose Fabrica is open right now
//  - isOrgAdmin ............ admin of the open organisation (or a super admin)
export function AppAuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(supabaseEnabled);
  const [access, setAccess] = useState(null);
  const [activeOrg, setActiveOrgState] = useState(null);
  const [recovering, setRecovering] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!supabaseEnabled) return;

    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (sessionError) setError(sessionError.message);
      setSession(data?.session ?? null);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
      if (event === "SIGNED_IN" && sessionStorage.getItem(RESET_FLAG_KEY)) setRecovering(true);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  // Load what this person may open: claim any pending invitations for
  // their (confirmed) email, then read their memberships and super-admin
  // flag. Runs again whenever a different person signs in.
  const userId = session?.user?.id ?? null;
  const hasEmail = Boolean(session?.user?.email);

  const loadAccess = useCallback(async () => {
    if (!supabaseEnabled || !userId || !hasEmail) {
      setAccess(null);
      return;
    }
    const { error: claimError } = await supabase.rpc("claim_invitations");
    if (claimError) console.error("Fabrica: claiming invitations failed", claimError);

    const [{ data: sa, error: saError }, { data: mem, error: memError }] = await Promise.all([
      supabase.from("super_admins").select("user_id").eq("user_id", userId).maybeSingle(),
      supabase
        .from("memberships")
        .select("org_id, role, organizations(id, name, status, plan, plan_status, trial_ends_at, renews_on)")
        .eq("user_id", userId),
    ]);
    if (saError || memError) {
      const e = saError || memError;
      console.error("Fabrica: loading access failed", e);
      setError(e.message);
    }
    const memberships = (mem || [])
      .filter((m) => m.organizations)
      .map((m) => ({ orgId: m.org_id, role: m.role, org: m.organizations }));
    setAccess({ isSuperAdmin: Boolean(sa), memberships });
  }, [userId, hasEmail]);

  useEffect(() => {
    setAccess(null);
    setActiveOrgState(null);
    if (!userId) return;
    loadAccess();
  }, [userId, loadAccess]);

  // Pick the organisation to open once access is known: the one used last
  // time, or the only one this person belongs to.
  useEffect(() => {
    if (!access || activeOrg) return;
    let stored = null;
    try { stored = localStorage.getItem(ACTIVE_ORG_KEY); } catch { /* ignore */ }
    const pick =
      access.memberships.find((m) => m.orgId === stored) ||
      (access.memberships.length === 1 && !access.isSuperAdmin ? access.memberships[0] : null);
    if (pick) setActiveOrgState({ ...pick.org, viaAdmin: false });
  }, [access, activeOrg]);

  const enterOrg = useCallback((org, viaAdmin = false) => {
    try { localStorage.setItem(ACTIVE_ORG_KEY, org.id); } catch { /* ignore */ }
    setActiveOrgState({ ...org, viaAdmin });
  }, []);

  const leaveOrg = useCallback(() => {
    try { localStorage.removeItem(ACTIVE_ORG_KEY); } catch { /* ignore */ }
    setActiveOrgState(null);
  }, []);

  // ── sign-in methods ──
  const signInWithGoogle = async () => {
    setError(null);
    sessionStorage.removeItem(RESET_FLAG_KEY);
    const { error: e } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: appUrl(), queryParams: { prompt: "select_account" } },
    });
    if (e) setError(e.message);
  };

  const signInWithPassword = async (email, password) => {
    setError(null);
    sessionStorage.removeItem(RESET_FLAG_KEY);
    const { error: e } = await supabase.auth.signInWithPassword({ email, password });
    if (e) { setError(e.message); return false; }
    return true;
  };

  // Returns "confirm" when a confirmation email was sent, "signedin" when
  // the account was created and signed in straight away, or null on error.
  const signUpWithPassword = async (email, password, fullName) => {
    setError(null);
    const { data, error: e } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: appUrl(), data: fullName ? { full_name: fullName } : {} },
    });
    if (e) { setError(e.message); return null; }
    return data.session ? "signedin" : "confirm";
  };

  const sendPasswordReset = async (email) => {
    setError(null);
    sessionStorage.setItem(RESET_FLAG_KEY, "1");
    const { error: e } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: appUrl() });
    if (e) { setError(e.message); return false; }
    return true;
  };

  const setNewPassword = async (password) => {
    setError(null);
    const { error: e } = await supabase.auth.updateUser({ password });
    if (e) { setError(e.message); return false; }
    sessionStorage.removeItem(RESET_FLAG_KEY);
    setRecovering(false);
    return true;
  };

  const signOut = async () => {
    try { localStorage.removeItem(ACTIVE_ORG_KEY); } catch { /* ignore */ }
    await supabase.auth.signOut();
    setSession(null);
    setAccess(null);
    setActiveOrgState(null);
  };

  const activeMembership = access?.memberships.find((m) => m.orgId === activeOrg?.id) || null;
  const isSuperAdmin = Boolean(access?.isSuperAdmin);
  // Outside Supabase mode (local-only), the single user is effectively an admin.
  const isOrgAdmin = !supabaseEnabled || isSuperAdmin || activeMembership?.role === "admin";

  const value = useMemo(
    () => ({
      session, user: session?.user ?? null, loading, error, recovering,
      access, isSuperAdmin, memberships: access?.memberships || [],
      activeOrg, activeMembership, isOrgAdmin,
      enterOrg, leaveOrg, reloadAccess: loadAccess,
      signInWithGoogle, signInWithPassword, signUpWithPassword, sendPasswordReset, setNewPassword, signOut,
      clearError: () => setError(null),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, loading, error, recovering, access, activeOrg, loadAccess]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AppAuthProvider");
  return ctx;
}
