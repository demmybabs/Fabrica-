import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { useConfirm } from "../lib/ConfirmContext";
import Panel from "../components/Panel";
import { Field, inputCls, btnCls } from "../components/Field";

const emailOk = (e) => /^\S+@\S+\.\S+$/.test(e);

// Organisation admins invite and manage the people in their own
// organisation. (Row-level security in the database enforces that an admin
// can only touch their own organisation's people.)
export default function Team() {
  const { activeOrg, user } = useAuth();
  const confirmAction = useConfirm();
  const orgId = activeOrg.id;
  const [members, setMembers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [m, i] = await Promise.all([
      supabase.from("memberships").select("*").eq("org_id", orgId).order("created_at", { ascending: true }),
      supabase.from("invitations").select("*").eq("org_id", orgId).order("created_at", { ascending: true }),
    ]);
    if (m.error || i.error) setError((m.error || i.error).message);
    setMembers(m.data || []);
    setInvites(i.data || []);
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  const run = async (promise) => {
    const { error: e } = await promise;
    if (e) { setError(e.message); return false; }
    setError("");
    await load();
    return true;
  };

  const adminCount = members.filter((m) => m.role === "admin").length;

  const invite = async (e) => {
    e.preventDefault();
    const addr = email.trim().toLowerCase();
    if (!emailOk(addr)) return setError("Enter a valid email address.");
    if (members.some((m) => (m.email || "").toLowerCase() === addr)) return setError("That person is already in this organisation.");
    if (await run(supabase.from("invitations").insert({ org_id: orgId, email: addr, role }))) setEmail("");
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="chip text-ink-400 uppercase">{activeOrg.name}</div>
        <h1 className="font-display text-xl font-semibold text-ink-50">Team</h1>
      </div>

      {error && <div className="chip text-red-400">{error}</div>}

      <Panel title="Invite someone" eyebrow="Anyone you invite can sign in with Google or an email + password">
        <form onSubmit={invite} className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <div className="flex-1">
            <Field label="Their email">
              <input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" />
            </Field>
          </div>
          <Field label="Role">
            <select className={inputCls} value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </Field>
          <button type="submit" className={`${btnCls} py-2`}>Invite</button>
        </form>
        <p className="text-xs text-ink-500 mt-3 leading-relaxed">
          Members can use every module. Admins can also change Settings and manage this team. No email is
          sent from here — tell them to open Fabrica and sign in (or create a login) using exactly this email
          address, and they'll land in {activeOrg.name}.
        </p>
      </Panel>

      <Panel title="People" eyebrow={`${members.length} in ${activeOrg.name}`}>
        <ul className="divide-y divide-ink-700/60">
          {members.map((m) => {
            const isMe = m.user_id === user?.id;
            const lastAdmin = m.role === "admin" && adminCount <= 1;
            return (
              <li key={m.user_id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm text-ink-100 truncate">{m.full_name || m.email || m.user_id}{isMe && <span className="chip text-ink-500"> · you</span>}</div>
                  {m.full_name && <div className="text-xs text-ink-500 truncate">{m.email}</div>}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <select
                    className="bg-ink-900 border border-ink-700 rounded px-2 py-1 text-xs text-ink-100 disabled:opacity-50"
                    value={m.role}
                    disabled={lastAdmin}
                    title={lastAdmin ? "An organisation needs at least one admin" : undefined}
                    onChange={(e) => run(supabase.from("memberships").update({ role: e.target.value }).eq("org_id", orgId).eq("user_id", m.user_id))}
                  >
                    <option value="admin">Admin</option>
                    <option value="member">Member</option>
                  </select>
                  {!lastAdmin && !isMe && (
                    <button
                      className="text-ink-500 hover:text-red-400 text-xs"
                      onClick={async () => {
                        if (await confirmAction(`Remove ${m.email || "this person"} from ${activeOrg.name}? They'll lose access immediately.`, { danger: true, confirmLabel: "Remove" }))
                          run(supabase.from("memberships").delete().eq("org_id", orgId).eq("user_id", m.user_id));
                      }}
                    >
                      remove
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </Panel>

      {invites.length > 0 && (
        <Panel title="Waiting to join" eyebrow="Invited, haven't signed in yet">
          <ul className="divide-y divide-ink-700/60">
            {invites.map((i) => (
              <li key={i.id} className="py-3 flex items-center justify-between gap-3">
                <span className="text-sm text-ink-200 truncate">{i.email} <span className="chip text-brass-400">{i.role}</span></span>
                <button className="text-ink-500 hover:text-red-400 text-xs" onClick={() => run(supabase.from("invitations").delete().eq("id", i.id))}>cancel invite</button>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel title="Plan" eyebrow="Managed by the Fabrica administrator">
        <div className="text-sm text-ink-200 flex flex-wrap gap-x-8 gap-y-2">
          <span>Plan: <span className="text-ink-50">{activeOrg.plan}</span></span>
          <span>Billing: <span className="text-ink-50">{String(activeOrg.plan_status || "").replace("_", " ")}</span></span>
          {activeOrg.trial_ends_at && <span>Trial ends: <span className="text-ink-50">{activeOrg.trial_ends_at}</span></span>}
          {activeOrg.renews_on && <span>Renews: <span className="text-ink-50">{activeOrg.renews_on}</span></span>}
        </div>
      </Panel>
    </div>
  );
}
