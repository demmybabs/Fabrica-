-- Fabrica — v23 migration: opening cash balance + custom expense categories.
-- Run this once in the Supabase SQL editor, AFTER migration_v22.sql.
-- Safe to run more than once.
--
-- What this adds:
--   1. An `expense_categories` column on `app_settings`, seeded with the
--      current default list — lets you add your own operating-expense
--      categories from the Financials module instead of being limited to
--      the built-in ones.
--   2. A new chart_of_accounts row: Opening Balance Equity (equity). This
--      is the standard bookkeeping account used to record the one-time
--      cash/bank balance you were already holding before the Financials
--      module went live, without misstating it as a fresh Owner's Capital
--      contribution.
--
-- Nothing here touches existing tables' data — only adds a column (with a
-- safe default) and a new reference row.

alter table app_settings add column if not exists expense_categories text[]
  default array['Rent','Salaries & wages','Utilities','Transport & logistics','Marketing','Professional fees','Repairs & maintenance','Insurance','Bank charges','Other'];

update app_settings set expense_categories = array['Rent','Salaries & wages','Utilities','Transport & logistics','Marketing','Professional fees','Repairs & maintenance','Insurance','Bank charges','Other']
  where expense_categories is null;

insert into chart_of_accounts (code, name, type, normal_balance) values
  ('3200', 'Opening Balance Equity', 'equity', 'credit')
on conflict (code) do nothing;
