import { createContext, useContext, useEffect, useState } from "react";
import { supabase, supabaseEnabled } from "./supabaseClient";

const AuthContext = createContext(null);

// No login screen: the app signs itself in anonymously the instant it
// loads, which is enough to satisfy the database's "must be signed in"
// rule without ever asking for an email or password. Requires Anonymous
// Sign-Ins to be turned on in Supabase (Authentication → Providers).
export function AppAuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(supabaseEnabled);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!supabaseEnabled) return;

    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        setSession(data.session);
        setLoading(false);
        return;
      }
      const { data: signInData, error: signInError } = await supabase.auth.signInAnonymously();
      if (signInError) {
        console.error("Fabrica: anonymous sign-in failed", signInError);
        setError(signInError.message);
      } else {
        setSession(signInData.session);
      }
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ session, loading, error }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AppAuthProvider");
  return ctx;
}
