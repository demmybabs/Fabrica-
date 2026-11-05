import { useState } from "react";
import { useAuth } from "../lib/AuthContext";
import { inputCls, btnCls, btnGhostCls, Field } from "../components/Field";

function Shell({ title, subtitle, children }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-ink-950 text-ink-100 font-body px-6 py-10">
      <div className="w-full max-w-sm border border-ink-700 bg-ink-900 rounded-lg p-8">
        <div className="text-center mb-6">
          <div className="font-display text-2xl font-semibold tracking-tight text-ink-50">{title}</div>
          {subtitle && <div className="text-sm text-ink-400 mt-2 leading-relaxed">{subtitle}</div>}
        </div>
        {children}
      </div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.2 5.5-4.7 7.2l7.3 5.7c4.3-4 6.7-9.8 6.7-17.4z" />
      <path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.3-5.7c-2 1.4-4.6 2.3-8.6 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}

export function LoginScreen() {
  const { signInWithGoogle, signInWithPassword, signUpWithPassword, sendPasswordReset, error, clearError } = useAuth();
  const [mode, setMode] = useState("signin"); // signin | signup | reset
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const switchMode = (m) => { setMode(m); setNotice(""); clearError(); };

  const submit = async (e) => {
    e.preventDefault();
    setNotice("");
    setBusy(true);
    try {
      if (mode === "signin") {
        await signInWithPassword(email.trim(), password);
      } else if (mode === "signup") {
        if (password.length < 8) return setNotice("Choose a password of at least 8 characters.");
        const result = await signUpWithPassword(email.trim(), password, fullName.trim());
        if (result === "confirm") setNotice("Check your email and click the confirmation link, then come back and sign in.");
      } else {
        const ok = await sendPasswordReset(email.trim());
        if (ok) setNotice("If that email has an account, a reset link is on its way.");
      }
    } finally {
      setBusy(false);
    }
  };

  const subtitle =
    mode === "signup"
      ? "Create your login. Use the same email your organisation invited."
      : mode === "reset"
        ? "We'll email you a link to set a new password."
        : "Sign in to your organisation's workspace.";

  return (
    <Shell title="Fabrica" subtitle={subtitle}>
      {mode !== "reset" && (
        <>
          <button
            type="button"
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center gap-3 rounded border border-ink-600 bg-ink-800 hover:bg-ink-700 text-ink-50 text-sm py-2.5 transition-colors"
          >
            <GoogleMark />
            Continue with Google
          </button>
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 border-t border-ink-700" />
            <span className="chip text-ink-500">or</span>
            <div className="flex-1 border-t border-ink-700" />
          </div>
        </>
      )}

      <form onSubmit={submit} className="space-y-3">
        {mode === "signup" && (
          <Field label="Your name">
            <input className={inputCls} value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
          </Field>
        )}
        <Field label="Email">
          <input className={inputCls} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </Field>
        {mode !== "reset" && (
          <Field label="Password">
            <input
              className={inputCls}
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
            />
          </Field>
        )}
        <button type="submit" disabled={busy} className={`${btnCls} w-full py-2.5 disabled:opacity-50`}>
          {busy ? "Please wait…" : mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
        </button>
      </form>

      {error && <div className="mt-4 text-xs text-red-400 leading-relaxed">{error}</div>}
      {notice && <div className="mt-4 text-xs text-ink-300 leading-relaxed">{notice}</div>}

      <div className="mt-5 text-center text-xs text-ink-400 space-y-1.5">
        {mode === "signin" && (
          <>
            <div><button type="button" className="hover:text-ink-100 underline" onClick={() => switchMode("reset")}>Forgot password?</button></div>
            <div>Invited by your organisation? <button type="button" className="hover:text-ink-100 underline" onClick={() => switchMode("signup")}>Create your login</button></div>
          </>
        )}
        {mode !== "signin" && (
          <div><button type="button" className="hover:text-ink-100 underline" onClick={() => switchMode("signin")}>Back to sign in</button></div>
        )}
      </div>
    </Shell>
  );
}

export function SetPasswordScreen() {
  const { setNewPassword, error } = useAuth();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [short, setShort] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (password.length < 8) return setShort(true);
    setShort(false);
    setBusy(true);
    await setNewPassword(password);
    setBusy(false);
  };

  return (
    <Shell title="Set a new password" subtitle="Choose a password you'll use to sign in from now on.">
      <form onSubmit={submit} className="space-y-3">
        <Field label="New password">
          <input className={inputCls} type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
        </Field>
        <button type="submit" disabled={busy} className={`${btnCls} w-full py-2.5 disabled:opacity-50`}>
          {busy ? "Saving…" : "Save password"}
        </button>
      </form>
      {short && <div className="mt-4 text-xs text-red-400">Use at least 8 characters.</div>}
      {error && <div className="mt-4 text-xs text-red-400">{error}</div>}
    </Shell>
  );
}

export function NoAccessScreen() {
  const { user, signOut, reloadAccess } = useAuth();
  const [checking, setChecking] = useState(false);
  return (
    <Shell title="No workspace yet">
      <p className="text-sm text-ink-400 leading-relaxed text-center">
        You're signed in as <span className="text-ink-100">{user?.email}</span>, but this email hasn't
        been invited to any organisation. Ask your organisation's admin to invite this exact email, then
        check again.
      </p>
      <div className="mt-6 grid gap-2">
        <button
          type="button"
          disabled={checking}
          className={`${btnCls} py-2.5`}
          onClick={async () => { setChecking(true); await reloadAccess(); setChecking(false); }}
        >
          {checking ? "Checking…" : "Check again"}
        </button>
        <button type="button" className={`${btnGhostCls} py-2.5`} onClick={signOut}>Sign out</button>
      </div>
    </Shell>
  );
}

export function SuspendedScreen() {
  const { activeOrg, memberships, leaveOrg, signOut } = useAuth();
  return (
    <Shell title="Workspace suspended">
      <p className="text-sm text-ink-400 leading-relaxed text-center">
        Access to <span className="text-ink-100">{activeOrg?.name}</span> is currently switched off.
        Please contact the Fabrica administrator.
      </p>
      <div className="mt-6 grid gap-2">
        {memberships.length > 1 && <button type="button" className={`${btnCls} py-2.5`} onClick={leaveOrg}>Switch organisation</button>}
        <button type="button" className={`${btnGhostCls} py-2.5`} onClick={signOut}>Sign out</button>
      </div>
    </Shell>
  );
}

export function OrgPicker() {
  const { memberships, enterOrg, user, signOut } = useAuth();
  return (
    <Shell title="Choose an organisation" subtitle={user?.email}>
      <div className="grid gap-2">
        {memberships.map((m) => (
          <button
            key={m.orgId}
            type="button"
            onClick={() => enterOrg(m.org)}
            className="text-left rounded border border-ink-700 bg-ink-800 hover:border-[var(--accent)] px-4 py-3 transition-colors"
          >
            <div className="text-sm text-ink-50">{m.org.name}</div>
            <div className="chip text-ink-400 mt-0.5">
              {m.role === "admin" ? "Admin" : "Member"}{m.org.status === "suspended" ? " · suspended" : ""}
            </div>
          </button>
        ))}
      </div>
      <button type="button" className={`${btnGhostCls} w-full py-2.5 mt-5`} onClick={signOut}>Sign out</button>
    </Shell>
  );
}
