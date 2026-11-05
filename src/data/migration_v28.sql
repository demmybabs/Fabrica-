-- Fabrica — v28 migration: MULTI-ORGANISATION (each business gets its own Fabrica).
-- Run this once in the Supabase SQL editor, AFTER migration_v27.sql.
-- Safe to run more than once.
--
-- BEFORE YOU RUN IT: change the email on the very first line below to
-- YOUR OWN email — the one you will sign in with. That address becomes the
-- super admin (can see and manage every organisation) and the admin of the
-- first organisation, which receives all the data you have today.
--
-- What this does:
--   1. Creates `organizations` (one row per business, with plan/billing
--      fields and an active/suspended switch), `memberships` (who belongs
--      to which organisation, as admin or member), `invitations` (people
--      invited by email who haven't signed in yet), and `super_admins`.
--   2. Adds an `org_id` to every data table and moves ALL your existing
--      records into one first organisation. Nothing is deleted.
--   3. Makes `app_settings` per-organisation (it used to be one global row).
--   4. Replaces the old "anyone signed in" policies with strict ones:
--      a person can only reach rows whose org_id is an organisation they
--      belong to (and that is not suspended). Super admins can reach all.
--   5. Adds claim_invitations(): when a person signs in with an invited,
--      CONFIRMED email, they are attached to the organisation that
--      invited them.

create temp table _setup (owner_email text);
insert into _setup values ('CHANGE_ME@gmail.com');

do $$
begin
  if exists (select 1 from _setup where owner_email ilike 'CHANGE_ME%') then
    raise exception 'Edit the email on the first line of this script (CHANGE_ME@gmail.com) to your own email, then run it again.';
  end if;
end $$;

-- ───────────────────────── 1. New tables ─────────────────────────

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'active' check (status in ('active', 'suspended')),
  -- Billing is tracked here by hand; no payment provider is connected.
  plan text not null default 'trial',
  plan_status text not null default 'trial' check (plan_status in ('trial', 'active', 'past_due', 'cancelled')),
  trial_ends_at date,
  renews_on date,
  billing_notes text,
  created_at timestamptz default now()
);

create table if not exists memberships (
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  email text,
  full_name text,
  created_at timestamptz default now(),
  primary key (org_id, user_id)
);
create index if not exists memberships_user_idx on memberships(user_id);

create table if not exists invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  email text not null,
  role text not null default 'member' check (role in ('admin', 'member')),
  invited_by uuid default auth.uid(),
  created_at timestamptz default now()
);
create unique index if not exists invitations_org_email_idx on invitations(org_id, lower(email));

create table if not exists super_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);

-- Emails waiting to become super admin the first time they sign in.
-- No policies on purpose: only claim_invitations() can read it.
create table if not exists super_admin_invites (
  email text primary key
);

-- ───────────────────────── 2. Helper functions ─────────────────────────
-- security definer so they can read the membership tables without the
-- row-level policies calling themselves in a loop.

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.super_admins s
    join auth.users u on u.id = s.user_id
    where s.user_id = auth.uid() and u.email_confirmed_at is not null
  );
$$;

create or replace function public.my_org_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select org_id from public.memberships where user_id = auth.uid();
$$;

create or replace function public.my_active_org_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select m.org_id from public.memberships m
  join public.organizations o on o.id = m.org_id
  where m.user_id = auth.uid() and o.status = 'active';
$$;

create or replace function public.is_org_admin(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships
    where user_id = auth.uid() and org_id = p_org and role = 'admin'
  );
$$;

create or replace function public.is_member_anywhere()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.memberships where user_id = auth.uid());
$$;

-- Called by the app right after every sign-in. Attaches the person to
-- every organisation that invited their email. Only works for emails the
-- person has CONFIRMED (Google emails count as confirmed; for
-- email+password, keep "Confirm email" switched ON in Supabase).
create or replace function public.claim_invitations()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_confirmed timestamptz;
  v_name text;
begin
  if v_uid is null then return; end if;
  select lower(email), email_confirmed_at,
         coalesce(raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'name')
    into v_email, v_confirmed, v_name
    from auth.users where id = v_uid;
  if v_email is null or v_confirmed is null then return; end if;

  insert into memberships (org_id, user_id, role, email, full_name)
    select org_id, v_uid, role, v_email, v_name from invitations where lower(email) = v_email
    on conflict (org_id, user_id) do nothing;
  delete from invitations where lower(email) = v_email;

  if exists (select 1 from super_admin_invites where lower(email) = v_email) then
    insert into super_admins (user_id) values (v_uid) on conflict do nothing;
    delete from super_admin_invites where lower(email) = v_email;
  end if;
end $$;

revoke all on function public.is_super_admin() from public, anon;
revoke all on function public.my_org_ids() from public, anon;
revoke all on function public.my_active_org_ids() from public, anon;
revoke all on function public.is_org_admin(uuid) from public, anon;
revoke all on function public.is_member_anywhere() from public, anon;
revoke all on function public.claim_invitations() from public, anon;
grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.my_org_ids() to authenticated;
grant execute on function public.my_active_org_ids() to authenticated;
grant execute on function public.is_org_admin(uuid) to authenticated;
grant execute on function public.is_member_anywhere() to authenticated;
grant execute on function public.claim_invitations() to authenticated;

-- ───────────────────────── 3. Move today's data into org #1 ─────────────────────────

do $$
declare
  t text;
  v_org uuid;
begin
  select id into v_org from organizations order by created_at limit 1;
  if v_org is null then
    insert into organizations (name, plan, plan_status) values ('My Company', 'internal', 'active')
      returning id into v_org;
  end if;

  foreach t in array array[
    'suppliers', 'supply_batches', 'products', 'production_runs', 'customers',
    'sales_orders', 'spoilage', 'journal_entries', 'operating_expenses',
    'fixed_assets', 'equity_transactions', 'loans'
  ]
  loop
    execute format('alter table %I add column if not exists org_id uuid references organizations(id) on delete cascade', t);
    execute format('update %I set org_id = $1 where org_id is null', t) using v_org;
    execute format('alter table %I alter column org_id set not null', t);
    execute format('create index if not exists %I on %I(org_id)', t || '_org_id_idx', t);
  end loop;
end $$;

-- app_settings: one row PER ORGANISATION instead of one global row.
alter table app_settings add column if not exists org_id uuid references organizations(id) on delete cascade;
update app_settings set org_id = (select id from organizations order by created_at limit 1) where org_id is null;
alter table app_settings drop constraint if exists single_row;
alter table app_settings drop constraint if exists app_settings_pkey;
alter table app_settings drop column if exists id;
alter table app_settings alter column org_id set not null;
alter table app_settings add primary key (org_id);

-- Every new organisation automatically gets its own settings row, with its
-- name as the app branding.
create or replace function public.create_org_settings()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into app_settings (org_id, branding)
  values (new.id, jsonb_build_object('name', new.name, 'tagline', 'production line control', 'logoDataUrl', null))
  on conflict (org_id) do nothing;
  return new;
end $$;

drop trigger if exists organizations_create_settings on organizations;
create trigger organizations_create_settings
  after insert on organizations for each row execute function public.create_org_settings();

insert into app_settings (org_id)
  select o.id from organizations o where not exists (select 1 from app_settings s where s.org_id = o.id);

-- ───────────────────────── 4. Access rules (row-level security) ─────────────────────────

alter table organizations enable row level security;
alter table memberships enable row level security;
alter table invitations enable row level security;
alter table super_admins enable row level security;
alter table super_admin_invites enable row level security;

-- Throw away every old policy on these tables (including the earlier
-- "authenticated_all" / "allowed_users_all" ones), then start clean.
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public' and tablename = any (array[
      'app_settings', 'suppliers', 'supply_batches', 'products', 'production_runs',
      'customers', 'sales_orders', 'spoilage', 'chart_of_accounts', 'journal_entries',
      'operating_expenses', 'fixed_assets', 'equity_transactions', 'loans',
      'organizations', 'memberships', 'invitations', 'super_admins', 'super_admin_invites'
    ])
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- Business data: only rows of an organisation you belong to (and that is
-- not suspended). Super admins can reach everything.
do $$
declare t text;
begin
  foreach t in array array[
    'app_settings', 'suppliers', 'supply_batches', 'products', 'production_runs',
    'customers', 'sales_orders', 'spoilage', 'journal_entries', 'operating_expenses',
    'fixed_assets', 'equity_transactions', 'loans'
  ]
  loop
    execute format(
      'create policy org_isolation on %I for all
         using (org_id in (select public.my_active_org_ids()) or public.is_super_admin())
         with check (org_id in (select public.my_active_org_ids()) or public.is_super_admin())', t);
  end loop;
end $$;

-- The chart of accounts is a fixed reference list shared by everyone: read only.
create policy coa_read on chart_of_accounts for select
  using (public.is_member_anywhere() or public.is_super_admin());

create policy org_read on organizations for select
  using (id in (select public.my_org_ids()) or public.is_super_admin());
create policy org_super_write on organizations for all
  using (public.is_super_admin()) with check (public.is_super_admin());

create policy mem_read on memberships for select
  using (user_id = auth.uid() or org_id in (select public.my_org_ids()) or public.is_super_admin());
create policy mem_insert on memberships for insert
  with check (public.is_super_admin());
create policy mem_update on memberships for update
  using (public.is_org_admin(org_id) or public.is_super_admin())
  with check (public.is_org_admin(org_id) or public.is_super_admin());
create policy mem_delete on memberships for delete
  using (public.is_org_admin(org_id) or public.is_super_admin());

create policy inv_all on invitations for all
  using (public.is_org_admin(org_id) or public.is_super_admin())
  with check (public.is_org_admin(org_id) or public.is_super_admin());

create policy sa_read_own on super_admins for select using (user_id = auth.uid());

-- Clean up the earlier single-organisation allow-list experiment, if you ran it.
drop function if exists public.is_allowed_user();
drop table if exists allowed_users;

-- ───────────────────────── 5. You: super admin + admin of org #1 ─────────────────────────
-- Nothing to do by hand: the first time you sign in with this email, you
-- become super admin and admin of the first organisation.

insert into super_admin_invites (email)
  select lower(owner_email) from _setup on conflict do nothing;

insert into invitations (org_id, email, role)
  select (select id from organizations order by created_at limit 1), lower(owner_email), 'admin'
  from _setup
  on conflict do nothing;
