-- Fabrica ERP — Supabase/Postgres schema with row-level security.
-- Run this in the Supabase SQL editor once, on a fresh project.
--
-- Design note: nested lists that used to be plain JS arrays inside a
-- record (a product's ingredients, a production run's materials/outputs,
-- an order's line items) are stored here as jsonb columns on the parent
-- row, not as separate child tables. This keeps every row's shape a 1:1
-- match with what the app already works with in memory, so the app code
-- didn't need a rewrite to move from local storage to a shared database —
-- only the storage layer underneath changed. Security is still enforced
-- per row via the policies below.
--
-- Roles: owner (full access), supply, production_inventory,
-- sales_customers, customer (read-only, own records only).

create type user_role as enum (
  'owner', 'supply', 'production_inventory', 'sales_customers', 'customer'
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role user_role not null default 'customer',
  linked_customer_id uuid, -- set when role = 'customer', points at customers.id
  created_at timestamptz default now()
);

-- Single-row table for app-wide settings that used to live in local
-- storage: branding, currency, segments, wholesale categories, custom
-- units, and per-role color themes. Always id = 1.
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
  prices_by_segment jsonb default '{}'::jsonb,   -- { "Retail": 9.5, "Wholesale": 8.2 }
  ingredients jsonb default '[]'::jsonb,          -- [{ "itemName": "Rolled oats" }, ...]
  created_at timestamptz default now()
);

create table production_runs (
  id uuid primary key default gen_random_uuid(),
  batch_code text not null,
  date date not null default current_date,
  labor_cost numeric default 0,
  overhead_costs jsonb default '[]'::jsonb,       -- [{ "category": "Electricity", "cost": 12 }]
  notes text,
  inputs jsonb default '[]'::jsonb,               -- [{ "itemName": "Honey", "quantity": 8, "unit": "l" }]
  outputs jsonb default '[]'::jsonb,               -- [{ "productId": "...", "countedQuantity": 40 }]
  created_by uuid references profiles(id)
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
  custom_prices jsonb default '{}'::jsonb,        -- { "<productId>": 8.0 }
  created_at timestamptz default now()
);

create table sales_orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id),
  date date not null default current_date,
  payment_mode text default 'Cash',
  amount_paid numeric,
  items jsonb default '[]'::jsonb,                -- [{ "productId": "...", "quantity": 2, "unitPrice": 9.5 }]
  created_by uuid references profiles(id)
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

-- Row level security -----------------------------------------------------

alter table profiles enable row level security;
alter table app_settings enable row level security;
alter table suppliers enable row level security;
alter table supply_batches enable row level security;
alter table products enable row level security;
alter table production_runs enable row level security;
alter table customers enable row level security;
alter table sales_orders enable row level security;
alter table spoilage enable row level security;

create function current_role_name() returns user_role as $$
  select role from profiles where id = auth.uid();
$$ language sql stable security definer;

create policy settings_read on app_settings for select using (auth.uid() is not null);
create policy settings_write on app_settings for update using (current_role_name() = 'owner');

create policy owner_all on suppliers for all using (current_role_name() = 'owner');
create policy owner_all on supply_batches for all using (current_role_name() = 'owner');
create policy owner_all on products for all using (current_role_name() = 'owner');
create policy owner_all on production_runs for all using (current_role_name() = 'owner');
create policy owner_all on customers for all using (current_role_name() = 'owner');
create policy owner_all on sales_orders for all using (current_role_name() = 'owner');
create policy owner_all on spoilage for all using (current_role_name() = 'owner');

create policy supply_rw on suppliers for all using (current_role_name() in ('owner','supply'));
create policy supply_rw on supply_batches for all using (current_role_name() in ('owner','supply'));
create policy supply_read_products on products for select using (current_role_name() in ('owner','supply','production_inventory','sales_customers'));

create policy prod_rw_runs on production_runs for all using (current_role_name() in ('owner','production_inventory'));
create policy prod_rw_products on products for all using (current_role_name() in ('owner','production_inventory'));
create policy prod_rw_spoilage on spoilage for all using (current_role_name() in ('owner','production_inventory'));
create policy prod_read_supply on supply_batches for select using (current_role_name() in ('owner','production_inventory'));

create policy sales_rw_orders on sales_orders for all using (current_role_name() in ('owner','sales_customers'));
create policy sales_rw_customers on customers for all using (current_role_name() in ('owner','sales_customers'));

create policy customer_own_record on customers for select using (
  current_role_name() = 'customer'
  and id = (select linked_customer_id from profiles where id = auth.uid())
);
create policy customer_own_orders on sales_orders for select using (
  current_role_name() = 'customer'
  and customer_id = (select linked_customer_id from profiles where id = auth.uid())
);
create policy customer_read_products on products for select using (current_role_name() = 'customer');

create policy own_profile on profiles for select using (id = auth.uid());
create policy own_profile_update on profiles for update using (id = auth.uid());
