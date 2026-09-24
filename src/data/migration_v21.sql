-- Fabrica — v21 migration: Financials module (Income Statement, Balance
-- Sheet, Cash Flow Statement). Run this once in the Supabase SQL editor
-- of your LIVE project before using the updated app.
--
-- Everything here CREATES new tables — nothing touches suppliers,
-- supply_batches, products, production_runs, customers, sales_orders,
-- or spoilage. Your existing data is completely untouched. Safe to run
-- more than once (every statement is "if not exists" / "on conflict do
-- nothing").
--
-- Important: this ledger starts capturing transactions from TODAY
-- forward, not retroactively. Cash & Bank, Fixed Assets, and Owner's
-- Equity have no history before this — that's expected, since Fabrica
-- never tracked them before. Revenue, COGS, receivables, payables, and
-- inventory value are unaffected and continue to reflect your full
-- history, same as today.

create table if not exists chart_of_accounts (
  code text primary key,
  name text not null,
  type text not null check (type in ('asset', 'liability', 'equity', 'revenue', 'cogs', 'expense')),
  normal_balance text not null check (normal_balance in ('debit', 'credit'))
);

create table if not exists journal_entries (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  memo text,
  source_type text not null,
  source_id uuid,
  lines jsonb not null default '[]'::jsonb,
  created_at timestamptz default now()
);

create table if not exists operating_expenses (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  category text not null,
  description text,
  amount numeric not null,
  amount_paid numeric default 0
);

create table if not exists fixed_assets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  cost numeric not null,
  purchase_date date not null default current_date,
  useful_life_years numeric not null default 5,
  disposal_date date,
  notes text
);

create table if not exists equity_transactions (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  type text not null check (type in ('contribution', 'drawing')),
  amount numeric not null,
  notes text
);

alter table chart_of_accounts enable row level security;
alter table journal_entries enable row level security;
alter table operating_expenses enable row level security;
alter table fixed_assets enable row level security;
alter table equity_transactions enable row level security;

drop policy if exists authenticated_all on chart_of_accounts;
create policy authenticated_all on chart_of_accounts for all using (auth.uid() is not null);
drop policy if exists authenticated_all on journal_entries;
create policy authenticated_all on journal_entries for all using (auth.uid() is not null);
drop policy if exists authenticated_all on operating_expenses;
create policy authenticated_all on operating_expenses for all using (auth.uid() is not null);
drop policy if exists authenticated_all on fixed_assets;
create policy authenticated_all on fixed_assets for all using (auth.uid() is not null);
drop policy if exists authenticated_all on equity_transactions;
create policy authenticated_all on equity_transactions for all using (auth.uid() is not null);

insert into chart_of_accounts (code, name, type, normal_balance) values
  ('1000', 'Cash & Bank', 'asset', 'debit'),
  ('1100', 'Accounts Receivable', 'asset', 'debit'),
  ('1200', 'Inventory — Raw Materials', 'asset', 'debit'),
  ('1210', 'Inventory — Finished Goods', 'asset', 'debit'),
  ('1300', 'Fixed Assets, at cost', 'asset', 'debit'),
  ('1310', 'Accumulated Depreciation', 'asset', 'credit'),
  ('2000', 'Accounts Payable', 'liability', 'credit'),
  ('2100', 'VAT Payable', 'liability', 'credit'),
  ('2200', 'Accrued Expenses', 'liability', 'credit'),
  ('3000', 'Owner''s Capital', 'equity', 'credit'),
  ('3100', 'Owner''s Drawings', 'equity', 'debit'),
  ('4000', 'Sales Revenue', 'revenue', 'credit'),
  ('5000', 'Cost of Goods Sold', 'cogs', 'debit'),
  ('6000', 'Operating Expenses', 'expense', 'debit'),
  ('6200', 'Depreciation Expense', 'expense', 'debit'),
  ('6300', 'Marketing / CSR — Product Giveaways', 'expense', 'debit'),
  ('6400', 'Production Loss', 'expense', 'debit'),
  ('6500', 'Spoilage', 'expense', 'debit')
on conflict (code) do nothing;
