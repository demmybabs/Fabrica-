-- Fabrica — v26 migration: Sale or Return (consignment sales).
-- Run this once in the Supabase SQL editor, AFTER migration_v25.sql.
-- Safe to run more than once.
--
-- What this adds:
--   `sale_type`, `closed`, `closed_date` on sales_orders — a Sale-or-Return
--   order (sale_type = 'sale_or_return') ships goods to a customer on
--   consignment with nothing billed yet. No revenue, cost of goods, or
--   VAT is recognized until it's closed (closed = true, closed_date set)
--   and you say what was actually kept vs. returned — recorded per line
--   inside the existing `items` jsonb column as `quantityReturned`, so no
--   schema change was needed for that part.
--
-- Nothing here touches existing tables' data — only adds columns, all
-- nullable, defaulting an ordinary sale to behaving exactly as before
-- (sale_type null is treated the same as an ordinary sale everywhere in
-- the app).

alter table sales_orders add column if not exists sale_type text;
alter table sales_orders add column if not exists closed boolean;
alter table sales_orders add column if not exists closed_date date;
