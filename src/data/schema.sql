-- Fabrica ERP — Supabase/Postgres schema (single-user mode).
-- Run this in the SQL editor of a fresh Supabase project.
--
-- Access model: this is intentionally simple — anyone signed in (in
-- practice, just you) has full access to every table. There are no
-- roles and no separate logins to manage. If you later need several
-- people with different permissions, that's a schema change we can add
-- back in — just ask.
--
-- Design note: lists that used to be plain JS arrays inside a record (a
-- product's ingredients, a production run's materials/outputs, an
-- order's line items) are stored as jsonb columns on the parent row, not
-- as separate child tables — this keeps every row's shape a 1:1 match
-- with what the app already works with, so no app code needed to change
-- to move from local storage to this database.

create table app_settings (
  id int primary key default 1,
  branding jsonb default '{"name":"Fabrica","tagline":"production line control","logoDataUrl":null}'::jsonb,
  currency jsonb default '{"code":"NGN","symbol":"₦"}'::jsonb,
  segments text[] default array['Retail','Wholesale'],
  wholesale_sub_categories text[] default array['Supermarket','Distributor','Grocery store','Pharmacy'],
  expense_categories text[] default array['Rent','Salaries & wages','Utilities','Transport & logistics','Marketing','Professional fees','Repairs & maintenance','Insurance','Bank charges','Other'],
  custom_units jsonb default '{}'::jsonb,
  themes jsonb default '{}'::jsonb,
  vat_rate numeric default 7.5,
  receivables_days numeric default 30,
  payables_days numeric default 30,
  constraint single_row check (id = 1)
);
insert into app_settings (id) values (1);

create table suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact text,
  created_at timestamptz default now()
);

create table supply_batches (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid references suppliers(id),
  item_name text not null,
  quantity numeric not null,
  unit text not null,
  unit_cost numeric not null default 0,
  total_cost numeric not null,
  amount_paid numeric default 0,
  date_received date not null default current_date,
  expiry_date date,
  payables_days numeric,
  notes text
);

create table products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  flavor text,
  pack_size text not null,
  unit text not null default 'unit',
  image_data_url text,
  prices_by_segment jsonb default '{}'::jsonb,
  ingredients jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);

create table production_runs (
  id uuid primary key default gen_random_uuid(),
  batch_code text not null,
  date date not null default current_date,
  labor_cost numeric default 0,
  overhead_costs jsonb default '[]'::jsonb,
  notes text,
  inputs jsonb default '[]'::jsonb,
  outputs jsonb default '[]'::jsonb
);

create table customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  gender text,
  profession text,
  segment text default 'Retail',
  sub_category text,
  branch text,
  branches text[] default array[]::text[],
  state text,
  city text,
  email text,
  phone text,
  custom_prices jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table sales_orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id),
  branch text,
  date date not null default current_date,
  payment_mode text default 'Cash',
  amount_paid numeric,
  payments jsonb default '[]'::jsonb,
  invoice_number text,
  vat_rate numeric default 0,
  vat_amount numeric default 0,
  receivables_days numeric,
  -- Sale-or-Return (consignment): sale_type is 'sale_or_return' or null
  -- for an ordinary sale; closed/closed_date mark when it stopped being
  -- open (no revenue is recognized until then) — see lib/calc.js. Any
  -- per-item quantity_returned lives inside `items` (jsonb) itself.
  sale_type text,
  closed boolean,
  closed_date date,
  items jsonb default '[]'::jsonb
);

create table spoilage (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('product', 'material')),
  product_id uuid references products(id),
  item_name text,
  unit text,
  quantity numeric not null,
  date date not null default current_date,
  reason text,
  value_lost numeric default 0
);

-- Financials: a lightweight double-entry ledger underneath the modules
-- above. journal_entries is the source of truth for Cash & Bank, Fixed
-- Assets, and Owner's Equity — nothing else in the app tracked those
-- before. Revenue, COGS, receivables, payables, and inventory value
-- continue to be computed live from the tables above (as they always
-- were); the ledger's job is to add the pieces that had nowhere to live.
create table chart_of_accounts (
  code text primary key,
  name text not null,
  type text not null check (type in ('asset', 'liability', 'equity', 'revenue', 'cogs', 'expense')),
  normal_balance text not null check (normal_balance in ('debit', 'credit'))
);

create table journal_entries (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  memo text,
  source_type text not null, -- 'sale' | 'supply' | 'production' | 'spoilage' | 'expense' | 'fixed_asset' | 'equity' | 'manual'
  source_id uuid,
  lines jsonb not null default '[]'::jsonb, -- [{ accountCode, debit, credit }, ...] — must balance (sum debit = sum credit)
  created_at timestamptz default now()
);

create table operating_expenses (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  category text not null,
  description text,
  amount numeric not null,
  amount_paid numeric default 0
);

create table fixed_assets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  cost numeric not null,
  purchase_date date not null default current_date,
  useful_life_years numeric not null default 5,
  disposal_date date,
  notes text
);

create table equity_transactions (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  type text not null check (type in ('contribution', 'drawing')),
  holder text not null default 'owner' check (holder in ('owner', 'investor')),
  amount numeric not null,
  notes text
);

-- A simple debt register — kept entirely separate from equity, since a
-- loan carries a repayment obligation and interest that an ownership
-- stake doesn't.
create table loans (
  id uuid primary key default gen_random_uuid(),
  lender text not null,
  principal numeric not null,
  start_date date not null default current_date,
  interest_rate numeric default 0,
  term_months numeric,
  notes text,
  repayments jsonb not null default '[]'::jsonb,
  created_at timestamptz default now()
);

-- Row level security: simple "must be signed in" check, same rule on
-- every table, full access once authenticated.
alter table app_settings enable row level security;
alter table suppliers enable row level security;
alter table supply_batches enable row level security;
alter table products enable row level security;
alter table production_runs enable row level security;
alter table customers enable row level security;
alter table sales_orders enable row level security;
alter table spoilage enable row level security;
alter table chart_of_accounts enable row level security;
alter table journal_entries enable row level security;
alter table operating_expenses enable row level security;
alter table fixed_assets enable row level security;
alter table equity_transactions enable row level security;
alter table loans enable row level security;

create policy authenticated_all on app_settings for all using (auth.uid() is not null);
create policy authenticated_all on suppliers for all using (auth.uid() is not null);
create policy authenticated_all on supply_batches for all using (auth.uid() is not null);
create policy authenticated_all on products for all using (auth.uid() is not null);
create policy authenticated_all on production_runs for all using (auth.uid() is not null);
create policy authenticated_all on customers for all using (auth.uid() is not null);
create policy authenticated_all on sales_orders for all using (auth.uid() is not null);
create policy authenticated_all on spoilage for all using (auth.uid() is not null);
create policy authenticated_all on chart_of_accounts for all using (auth.uid() is not null);
create policy authenticated_all on journal_entries for all using (auth.uid() is not null);
create policy authenticated_all on operating_expenses for all using (auth.uid() is not null);
create policy authenticated_all on fixed_assets for all using (auth.uid() is not null);
create policy authenticated_all on equity_transactions for all using (auth.uid() is not null);
create policy authenticated_all on loans for all using (auth.uid() is not null);

-- Seed the chart of accounts (fixed reference list the app relies on).
insert into chart_of_accounts (code, name, type, normal_balance) values
  ('1000', 'Cash & Bank', 'asset', 'debit'),
  ('1100', 'Accounts Receivable', 'asset', 'debit'),
  ('1200', 'Inventory — Raw Materials', 'asset', 'debit'),
  ('1210', 'Inventory — Finished Goods', 'asset', 'debit'),
  ('1300', 'Fixed Assets, at cost', 'asset', 'debit'),
  ('1310', 'Accumulated Depreciation', 'asset', 'credit'),
  ('2000', 'Accounts Payable', 'liability', 'credit'),
  ('2050', 'Loans Payable', 'liability', 'credit'),
  ('2100', 'VAT Payable', 'liability', 'credit'),
  ('2200', 'Accrued Expenses', 'liability', 'credit'),
  ('3000', 'Owner''s Capital', 'equity', 'credit'),
  ('3100', 'Owner''s Drawings', 'equity', 'debit'),
  ('3050', 'Investor Capital', 'equity', 'credit'),
  ('3150', 'Investor Drawings / Redemptions', 'equity', 'debit'),
  ('4000', 'Sales Revenue', 'revenue', 'credit'),
  ('5000', 'Cost of Goods Sold', 'cogs', 'debit'),
  ('6000', 'Operating Expenses', 'expense', 'debit'),
  ('6100', 'Interest Expense', 'expense', 'debit'),
  ('6200', 'Depreciation Expense', 'expense', 'debit'),
  ('6300', 'Marketing / CSR — Product Giveaways', 'expense', 'debit'),
  ('6400', 'Production Loss', 'expense', 'debit'),
  ('6500', 'Spoilage', 'expense', 'debit')
on conflict (code) do nothing;
