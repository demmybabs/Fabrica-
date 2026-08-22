-- Fabrica ERP — Supabase/Postgres schema with row-level security.
-- Run this in the Supabase SQL editor once you have a project created.
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
  theme jsonb default '{}'::jsonb, -- { "mode": "dark", "accent": "#D97A3E", "background": "#12171B" }
  created_at timestamptz default now()
);

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
  unit_cost numeric not null,
  total_cost numeric generated always as (quantity * unit_cost) stored,
  amount_paid numeric default 0,
  date_received date not null default current_date,
  notes text
);

create table products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  flavor text,
  pack_size text not null, -- e.g. "500g", "1kg"
  unit text not null default 'unit',
  created_at timestamptz default now()
);

-- Recipe / bill of materials: quantity needed per ONE unit of the product,
-- scaled up at production time by the output quantity.
create table product_ingredients (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade,
  item_name text not null,
  quantity_per_unit numeric not null,
  unit text not null
);

create table production_runs (
  id uuid primary key default gen_random_uuid(),
  batch_code text not null,
  run_date date not null default current_date,
  labor_cost numeric default 0,
  notes text,
  created_by uuid references profiles(id)
);

create table production_run_overheads (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references production_runs(id) on delete cascade,
  category text not null, -- e.g. Electricity, Water, Fuel, Maintenance, Other
  cost numeric not null
);

create table production_run_inputs (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references production_runs(id) on delete cascade,
  item_name text not null,
  quantity numeric not null,
  unit text not null
);

create table production_run_outputs (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references production_runs(id) on delete cascade,
  product_id uuid references products(id),
  quantity numeric not null
);

create table customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  gender text,
  profession text,
  segment text default 'Retail',
  phone text,
  created_at timestamptz default now()
);

create table sales_orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id),
  order_date date not null default current_date,
  payment_mode text default 'Cash',
  created_by uuid references profiles(id)
);

create table sales_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references sales_orders(id) on delete cascade,
  product_id uuid references products(id),
  quantity numeric not null,
  unit_price numeric not null
);

create table spoilage (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id),
  quantity numeric not null,
  spoiled_date date not null default current_date,
  reason text
);

create table custom_units (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  unit text not null,
  base_factor numeric not null
);

-- Row level security -----------------------------------------------------

alter table profiles enable row level security;
alter table suppliers enable row level security;
alter table supply_batches enable row level security;
alter table products enable row level security;
alter table product_ingredients enable row level security;
alter table production_runs enable row level security;
alter table production_run_overheads enable row level security;
alter table production_run_inputs enable row level security;
alter table production_run_outputs enable row level security;
alter table customers enable row level security;
alter table sales_orders enable row level security;
alter table sales_order_items enable row level security;
alter table spoilage enable row level security;
alter table custom_units enable row level security;

create function current_role_name() returns user_role as $$
  select role from profiles where id = auth.uid();
$$ language sql stable security definer;

-- Owner: full access to everything.
create policy owner_all on suppliers for all using (current_role_name() = 'owner');
create policy owner_all on supply_batches for all using (current_role_name() = 'owner');
create policy owner_all on products for all using (current_role_name() = 'owner');
create policy owner_all on product_ingredients for all using (current_role_name() = 'owner');
create policy owner_all on production_runs for all using (current_role_name() = 'owner');
create policy owner_all on production_run_overheads for all using (current_role_name() = 'owner');
create policy owner_all on production_run_inputs for all using (current_role_name() = 'owner');
create policy owner_all on production_run_outputs for all using (current_role_name() = 'owner');
create policy owner_all on customers for all using (current_role_name() = 'owner');
create policy owner_all on sales_orders for all using (current_role_name() = 'owner');
create policy owner_all on sales_order_items for all using (current_role_name() = 'owner');
create policy owner_all on spoilage for all using (current_role_name() = 'owner');
create policy owner_all on custom_units for all using (current_role_name() = 'owner');

-- Supply: read/write supply + read-only products (for material names).
create policy supply_rw on suppliers for all using (current_role_name() in ('owner','supply'));
create policy supply_rw on supply_batches for all using (current_role_name() in ('owner','supply'));
create policy supply_read_products on products for select using (current_role_name() in ('owner','supply','production_inventory','sales_customers'));

-- Production + inventory: read/write production, read supply ledger, read/write products+recipes+spoilage.
create policy prod_rw_runs on production_runs for all using (current_role_name() in ('owner','production_inventory'));
create policy prod_rw_overheads on production_run_overheads for all using (current_role_name() in ('owner','production_inventory'));
create policy prod_rw_inputs on production_run_inputs for all using (current_role_name() in ('owner','production_inventory'));
create policy prod_rw_outputs on production_run_outputs for all using (current_role_name() in ('owner','production_inventory'));
create policy prod_rw_products on products for all using (current_role_name() in ('owner','production_inventory'));
create policy prod_rw_ingredients on product_ingredients for all using (current_role_name() in ('owner','production_inventory'));
create policy prod_rw_spoilage on spoilage for all using (current_role_name() in ('owner','production_inventory'));
create policy prod_read_supply on supply_batches for select using (current_role_name() in ('owner','production_inventory'));

-- Sales + customers: read/write sales and customers, read-only products.
create policy sales_rw_orders on sales_orders for all using (current_role_name() in ('owner','sales_customers'));
create policy sales_rw_items on sales_order_items for all using (current_role_name() in ('owner','sales_customers'));
create policy sales_rw_customers on customers for all using (current_role_name() in ('owner','sales_customers'));

-- Customer: read only their own orders and their own customer record.
create policy customer_own_record on customers for select using (
  current_role_name() = 'customer'
  and id = (select linked_customer_id from profiles where id = auth.uid())
);
create policy customer_own_orders on sales_orders for select using (
  current_role_name() = 'customer'
  and customer_id = (select linked_customer_id from profiles where id = auth.uid())
);
create policy customer_own_items on sales_order_items for select using (
  current_role_name() = 'customer'
  and order_id in (
    select id from sales_orders where customer_id = (select linked_customer_id from profiles where id = auth.uid())
  )
);

-- Everyone can read and update their own profile (e.g. their theme).
create policy own_profile on profiles for select using (id = auth.uid());
create policy own_profile_update on profiles for update using (id = auth.uid());
