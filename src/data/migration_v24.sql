-- Fabrica — v24 migration: receivables/payables due-date tracking.
-- Run this once in the Supabase SQL editor, AFTER migration_v23.sql.
-- Safe to run more than once.
--
-- What this adds:
--   1. `receivables_days` / `payables_days` on app_settings — the default
--      number of days customers/suppliers have to pay (30, as agreed),
--      editable in Settings.
--   2. `receivables_days` on sales_orders — an optional per-order
--      override of the default, set at the time a credit sale is
--      recorded (so a due date can be computed as order date +
--      receivables days).
--   3. `payables_days` on supply_batches — the same, for a delivery
--      taken on account from a supplier.
--
-- Nothing here touches existing tables' data — only adds columns, all
-- with safe defaults/nullable.

alter table app_settings add column if not exists receivables_days numeric default 30;
alter table app_settings add column if not exists payables_days numeric default 30;
update app_settings set receivables_days = 30 where receivables_days is null;
update app_settings set payables_days = 30 where payables_days is null;

alter table sales_orders add column if not exists receivables_days numeric;
alter table supply_batches add column if not exists payables_days numeric;
