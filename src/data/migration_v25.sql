-- Fabrica — v25 migration: multi-branch wholesale customers.
-- Run this once in the Supabase SQL editor, AFTER migration_v24.sql.
-- Safe to run more than once.
--
-- What this adds:
--   1. `branches` on customers — a store (e.g. a supermarket chain) can
--      now carry a list of branch/location names, instead of the single
--      free-text `branch` field. The old `branch` column is left in
--      place and untouched, so existing customer records are unaffected;
--      onboarding just now offers a branches list for a wholesale
--      customer with more than one location.
--   2. `branch` on sales_orders — which branch a given order is being
--      delivered to, so each branch gets its own invoice-number sequence
--      (the branch name feeds the same invoice-number rule already in
--      use, in place of the customer's single branch/category).
--
-- Nothing here touches existing tables' data — only adds columns, both
-- nullable/defaulted, and neither is required for a customer or order
-- that doesn't need it.

alter table customers add column if not exists branches text[] default array[]::text[];
alter table sales_orders add column if not exists branch text;
