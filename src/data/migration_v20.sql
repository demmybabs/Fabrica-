-- Fabrica — v20 migration. Run this once in the Supabase SQL editor of
-- your LIVE project before using the updated app.
--
-- Every line below only adds a new column (with a safe default) or
-- widens something — nothing here deletes, renames, or rewrites any
-- existing row. Your current data is untouched. Safe to run more than
-- once (every statement is "if not exists").

-- In case the earlier "payments" column was never added to your live
-- database (it should already be there — this is just a safety net):
alter table sales_orders add column if not exists payments jsonb default '[]'::jsonb;

-- VAT capture per sale (item 2).
alter table sales_orders add column if not exists vat_rate numeric default 0;
alter table sales_orders add column if not exists vat_amount numeric default 0;

-- Auto-generated invoice number per sale (item 9).
alter table sales_orders add column if not exists invoice_number text;

-- Expiry date for supplied materials (item 7).
alter table supply_batches add column if not exists expiry_date date;

-- Branch / location for wholesale customers, used to build the wholesale
-- invoice number (item 9) — Store initials + Branch initials.
alter table customers add column if not exists branch text;

-- Default VAT rate (%) used to prefill the VAT field when recording a
-- sale — editable per sale, this is just the starting suggestion.
alter table app_settings add column if not exists vat_rate numeric default 7.5;
update app_settings set vat_rate = 7.5 where vat_rate is null;

-- Nothing else needs a schema change: giveaway/charity flags on a sale
-- line, and production-loss quantities on a production run's outputs,
-- are stored inside the existing "items" and "outputs" jsonb columns —
-- no new columns required for those.
