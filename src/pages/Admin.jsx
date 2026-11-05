import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { useConfirm } from "../lib/ConfirmContext";
import Panel from "../components/Panel";
import StatCard from "../components/StatCard";
import { Field, inputCls, btnCls, btnGhostCls } from "../components/Field";

const PLANS = ["trial", "starter", "growth", "enterprise", "internal"];
const PLAN_STATUSES = ["trial", "active", "past_due", "cancelled"];

const statusTone = {
  active: "text-moss-400",
  suspended: "text-rust-400",
  trial: "text-brass-400",
  past_due: "text-rust-400",
  cancelled: "text-ink-500",
};

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

const emailOk = (e) => /^\S+@\S+\.\S+$/.test(e);

// The super-admin console: every organisation, every user, billing status,
// and a way into any organisation's Fabrica.
export default function Admin() {
  const { user, signOut, enterOrg } = useAuth();
  const confirmAction = useConfirm();
  const [orgs, setOrgs] = useState([]);
  const [members, setMembers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState(null);
  const [form, setForm] = useState({ name: "", adminEmail: "", plan: "trial", planStatus: "trial", trialEndsAt: "" });
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const [o, m, i] = await Promise.all([
      supabase.from("organizations").select("*").order("created_at", { ascending: true }),
      supabase.from("memberships").select("*").order("created_at", { ascending: true }),
      supabase.from("invitations").select("*").order("created_at", { ascending: true }),
    ]);
    const err = o.error || m.error || i.error;
    if (err) setError(err.message);
    setOrgs(o.data || []);
    setMembers(m.data || []);
    setInvites(i.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const run = async (promise, fallback = "That didn't work.") => {
    const { error: e } = await promise;
    if (e) { setError(e.message || fallback); return false; }
    setError("");
    await load();
    return true;
  };

  const stats = useMemo(() => ({
    total: orgs.length,
    active: orgs.filter((o) => o.status === "active").length,
    suspended: orgs.filter((o) => o.status === "suspended").length,
    users: new Set(members.map((m) => m.user_id)).size,
    pastDue: orgs.filter((o) => o.plan_status === "past_due").length,
  }), [orgs, members]);

  const createOrg = async (e) => {
    e.preventDefault();
    const name = form.name.trim();
    const adminEmail = form.adminEmail.trim().toLowerCase();
    if (!name) return setError("Give the organisation a name.");
    if (!emailOk(adminEmail)) return setError("Enter the first admin's email address.");
    setCreating(true);
    const { data: org, error: orgErr } = await supabase
      .from("organizations")
      .insert({ name, plan: form.plan, plan_status: form.planStatus, trial_ends_at: form.trialEndsAt || null })
      .select()
      .single();
    if (orgErr) { setCreating(false); return setError(orgErr.message); }
    const { error: invErr } = await supabase.from("invitations").insert({ org_id: org.id, email: adminEmail, role: "admin" });
    setCreating(false);
    if (invErr) setError(`Organisation created, but the invitation failed: ${invErr.message}`);
    else setError("");
    setForm({ name: "", adminEmail: "", plan: "trial", planStatus: "trial", trialEndsAt: "" });
    setOpenId(org.id);
    load();
  };

  return (
    <div className="min-h-screen bg-ink-950 text-ink-100 font-body">
      <header className="flex items-center justify-between px-6 md:px-8 py-4 border-b border-ink-700 bg-ink-900">
        <div>
          <div className="font-display text-lg font-semibold text-ink-50">Fabrica · Super admin</div>
          <div className="chip text-ink-400">all organisations</div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-ink-400 hidden sm:inline">{user?.email}</span>
          <button className={btnGhostCls} onClick={signOut}>Sign out</button>
        </div>
      </header>

      <main className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
        {error && (
          <div className="bg-red-950 border border-red-400 rounded px-4 py-2.5 flex items-start justify-between gap-4">
            <span className="text-sm text-red-200">{error}</span>
            <button className="text-red-300 hover:text-white leading-none" onClick={() => setError("")}>×</button>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard label="Organisations" value={stats.total} />
          <StatCard label="Active" value={stats.active} tone="moss" />
          <StatCard label="Suspended" value={stats.suspended} tone="rust" />
          <StatCard label="Past due" value={stats.pastDue} tone="brass" />
          <StatCard label="Users" value={stats.users} />
        </div>

        <Panel title="Create an organisation" eyebrow="Gives a business its own, empty Fabrica">
          <form onSubmit={createOrg} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Organisation name">
              <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Crunchy Foods Ltd" />
            </Field>
            <Field label="First admin's email">
              <input className={inputCls} type="email" value={form.adminEmail} onChange={(e) => setForm({ ...form, adminEmail: e.target.value })} placeholder="admin@theirbusiness.com" />
            </Field>
            <Field label="Plan">
              <select className={inputCls} value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })}>
                {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="Billing status">
              <select className={inputCls} value={form.planStatus} onChange={(e) => setForm({ ...form, planStatus: e.target.value })}>
                {PLAN_STATUSES.map((p) => <option key={p} value={p}>{p.replace("_", " ")}</option>)}
              </select>
            </Field>
            <Field label="Trial ends (optional)">
              <input className={inputCls} type="date" value={form.trialEndsAt} onChange={(e) => setForm({ ...form, trialEndsAt: e.target.value })} />
            </Field>
            <div className="flex items-end">
              <button type="submit" disabled={creating} className={`${btnCls} py-2 disabled:opacity-50`}>
                {creating ? "Creating…" : "Create organisation"}
              </button>
            </div>
          </form>
          <p className="text-xs text-ink-500 mt-3">
            The admin is invited by email. They open the app, sign in with Google or create a login with that
            exact email, and land in this organisation automatically. Nothing is emailed to them for you — tell them to go sign in.
          </p>
        </Panel>

        <Panel title="Organisations" eyebrow={loading ? "Loading…" : `${orgs.length} total`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: "760px" }}>
              <thead>
                <tr className="text-left chip text-ink-500 uppercase border-b border-ink-700">
                  <th className="py-2 pr-4">Organisation</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Plan</th>
                  <th className="py-2 pr-4">Billing</th>
                  <th className="py-2 pr-4">Users</th>
                  <th className="py-2 pr-4">Created</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {orgs.map((o) => {
                  const orgMembers = members.filter((m) => m.org_id === o.id);
                  const orgInvites = invites.filter((i) => i.org_id === o.id);
                  const isOpen = openId === o.id;
                  return (
                    <OrgRow
                      key={o.id}
                      org={o}
                      members={orgMembers}
                      invites={orgInvites}
                      isOpen={isOpen}
                      toggle={() => setOpenId(isOpen ? null : o.id)}
                      run={run}
                      confirmAction={confirmAction}
                      enter={() => enterOrg(o, true)}
                    />
                  );
                })}
                {!loading && orgs.length === 0 && (
                  <tr><td colSpan={7} className="py-6 text-center text-ink-500">No organisations yet — create the first one above.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>

        <p className="text-xs text-ink-500">
          Billing here is a record you keep by hand — no payment provider is connected, and a "past due" or
          "cancelled" status does not lock anyone out by itself. Use Suspend to switch an organisation off.
        </p>
      </main>
    </div>
  );
}

function OrgRow({ org, members, invites, isOpen, toggle, run, confirmAction, enter }) {
  const [billing, setBilling] = useState({
    plan: org.plan, plan_status: org.plan_status,
    trial_ends_at: org.trial_ends_at || "", renews_on: org.renews_on || "", billing_notes: org.billing_notes || "",
    name: org.name,
  });
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");

  const saveBilling = () =>
    run(
      supabase.from("organizations").update({
        name: billing.name.trim() || org.name,
        plan: billing.plan,
        plan_status: billing.plan_status,
        trial_ends_at: billing.trial_ends_at || null,
        renews_on: billing.renews_on || null,
        billing_notes: billing.billing_notes || null,
      }).eq("id", org.id)
    );

  const toggleSuspend = async () => {
    const suspending = org.status === "active";
    const msg = suspending
      ? `Suspend ${org.name}? Nobody in this organisation will be able to open it until you reactivate it. Their data is kept.`
      : `Reactivate ${org.name}?`;
    if (await confirmAction(msg, { danger: suspending, confirmLabel: suspending ? "Suspend" : "Reactivate" })) {
      run(supabase.from("organizations").update({ status: suspending ? "suspended" : "active" }).eq("id", org.id));
    }
  };

  const deleteOrg = async () => {
    const ok = await confirmAction(
      `Permanently delete ${org.name} and ALL of its data (suppliers, products, production, sales, customers, financials, settings, and its user links)? This cannot be undone.`,
      { danger: true, confirmLabel: "Delete forever", requireTyped: "DELETE" }
    );
    if (ok) run(supabase.from("organizations").delete().eq("id", org.id));
  };

  const addInvite = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!emailOk(email)) return;
    const ok = await run(supabase.from("invitations").insert({ org_id: org.id, email, role: inviteRole }));
    if (ok) setInviteEmail("");
  };

  return (
    <>
      <tr className="border-b border-ink-700/60 text-ink-200 align-top">
        <td className="py-3 pr-4">
          <button className="text-left text-ink-50 hover:text-[var(--accent)]" onClick={toggle}>
            {isOpen ? "▾" : "▸"} {org.name}
          </button>
        </td>
        <td className={`py-3 pr-4 chip uppercase ${statusTone[org.status]}`}>{org.status}</td>
        <td className="py-3 pr-4 chip">{org.plan}</td>
        <td className={`py-3 pr-4 chip uppercase ${statusTone[org.plan_status]}`}>{org.plan_status.replace("_", " ")}</td>
        <td className="py-3 pr-4">
          {members.length}
          {invites.length > 0 && <span className="text-ink-500"> (+{invites.length} invited)</span>}
        </td>
        <td className="py-3 pr-4 text-ink-400">{fmtDate(org.created_at)}</td>
        <td className="py-3 text-right whitespace-nowrap">
          <button className={btnCls} onClick={enter}>Open</button>
        </td>
      </tr>
      {isOpen && (
        <tr className="border-b border-ink-700/60 bg-ink-900/40">
          <td colSpan={7} className="p-5">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-3">
                <div className="chip text-ink-400 uppercase">Billing &amp; details</div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Name"><input className={inputCls} value={billing.name} onChange={(e) => setBilling({ ...billing, name: e.target.value })} /></Field>
                  <Field label="Plan">
                    <select className={inputCls} value={billing.plan} onChange={(e) => setBilling({ ...billing, plan: e.target.value })}>
                      {[...new Set([...PLANS, billing.plan])].map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </Field>
                  <Field label="Billing status">
                    <select className={inputCls} value={billing.plan_status} onChange={(e) => setBilling({ ...billing, plan_status: e.target.value })}>
                      {PLAN_STATUSES.map((p) => <option key={p} value={p}>{p.replace("_", " ")}</option>)}
                    </select>
                  </Field>
                  <Field label="Trial ends"><input className={inputCls} type="date" value={billing.trial_ends_at} onChange={(e) => setBilling({ ...billing, trial_ends_at: e.target.value })} /></Field>
                  <Field label="Next renewal"><input className={inputCls} type="date" value={billing.renews_on} onChange={(e) => setBilling({ ...billing, renews_on: e.target.value })} /></Field>
                </div>
                <Field label="Billing notes">
                  <textarea className={inputCls} rows={2} value={billing.billing_notes} onChange={(e) => setBilling({ ...billing, billing_notes: e.target.value })} placeholder="Invoice sent, paid by transfer, discount agreed…" />
                </Field>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button className={btnCls} onClick={saveBilling}>Save</button>
                  <button className={btnGhostCls} onClick={toggleSuspend}>{org.status === "active" ? "Suspend" : "Reactivate"}</button>
                  <button className="chip px-3 py-1.5 rounded border border-red-400 text-red-400 hover:bg-red-400/10" onClick={deleteOrg}>Delete organisation</button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="chip text-ink-400 uppercase">People</div>
                <ul className="space-y-1.5">
                  {members.map((m) => (
                    <li key={m.user_id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate text-ink-200">{m.full_name ? `${m.full_name} · ` : ""}{m.email || m.user_id}</span>
                      <span className="flex items-center gap-2 shrink-0">
                        <select
                          className="bg-ink-900 border border-ink-700 rounded px-1.5 py-1 text-xs text-ink-100"
                          value={m.role}
                          onChange={(e) => run(supabase.from("memberships").update({ role: e.target.value }).eq("org_id", m.org_id).eq("user_id", m.user_id))}
                        >
                          <option value="admin">admin</option>
                          <option value="member">member</option>
                        </select>
                        <button
                          className="text-ink-500 hover:text-red-400 text-xs"
                          onClick={async () => {
                            if (await confirmAction(`Remove ${m.email || "this person"} from ${org.name}?`, { danger: true, confirmLabel: "Remove" }))
                              run(supabase.from("memberships").delete().eq("org_id", m.org_id).eq("user_id", m.user_id));
                          }}
                        >
                          remove
                        </button>
                      </span>
                    </li>
                  ))}
                  {invites.map((i) => (
                    <li key={i.id} className="flex items-center justify-between gap-3 text-sm text-ink-400">
                      <span className="truncate">{i.email} <span className="chip text-brass-400">invited · {i.role}</span></span>
                      <button className="text-ink-500 hover:text-red-400 text-xs" onClick={() => run(supabase.from("invitations").delete().eq("id", i.id))}>cancel</button>
                    </li>
                  ))}
                  {members.length === 0 && invites.length === 0 && <li className="text-sm text-ink-500">No one yet.</li>}
                </ul>
                <div className="flex gap-2 pt-1">
                  <input className={inputCls} type="email" placeholder="Invite by email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
                  <select className="bg-ink-900 border border-ink-700 rounded px-2 text-sm text-ink-100" value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
                    <option value="member">member</option>
                    <option value="admin">admin</option>
                  </select>
                  <button className={btnCls} onClick={addInvite}>Invite</button>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
