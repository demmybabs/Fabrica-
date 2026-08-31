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
  custom_units jsonb default '{}'::jsonb,
  themes jsonb default '{}'::jsonb,
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
  date date not null default current_date,
  payment_mode text default 'Cash',
  amount_paid numeric,
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

create policy authenticated_all on app_settings for all using (auth.uid() is not null);
create policy authenticated_all on suppliers for all using (auth.uid() is not null);
create policy authenticated_all on supply_batches for all using (auth.uid() is not null);
create policy authenticated_all on products for all using (auth.uid() is not null);
create policy authenticated_all on production_runs for all using (auth.uid() is not null);
create policy authenticated_all on customers for all using (auth.uid() is not null);
create policy authenticated_all on sales_orders for all using (auth.uid() is not null);
create policy authenticated_all on spoilage for all using (auth.uid() is not null);
