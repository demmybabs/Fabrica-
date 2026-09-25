-- Fabrica — v22 migration: separates debt from equity in the Financials
-- module. Run this once in the Supabase SQL editor, AFTER migration_v21.sql.
-- Safe to run more than once.
--
-- What this adds:
--   1. A `loans` table — a simple debt register (lender, principal,
--      interest rate, term, repayments) that's entirely separate from
--      Owner's Equity. Debt has a repayment obligation and interest;
--      equity doesn't — mixing them would misstate both the Balance
--      Sheet and your leverage.
--   2. A `holder` column on `equity_transactions`, so a capital
--      contribution/drawing can be tagged as the owner's or an outside
--      investor's — kept on separate ledger accounts so one person's
--      stake never gets mixed into another's.
--   3. Four new chart_of_accounts rows: Loans Payable (liability),
--      Investor Capital / Investor Drawings (equity), and Interest
--      Expense (expense).
--
-- Nothing here touches existing tables' data — only adds a table, a
-- column (with a safe default), and new reference rows.

create table if not exists loans (
  id uuid primary key default gen_random_uuid(),
  lender text not null,
  principal numeric not null,
  start_date date not null default current_date,
  interest_rate numeric default 0, -- annual %, simple interest
  term_months numeric,
  notes text,
  repayments jsonb not null default '[]'::jsonb, -- [{date, amount, principalPortion, interestPortion}, ...]
  created_at timestamptz default now()
);

alter table loans enable row level security;
drop policy if exists authenticated_all on loans;
create policy authenticated_all on loans for all using (auth.uid() is not null);

alter table equity_transactions add column if not exists holder text not null default 'owner' check (holder in ('owner', 'investor'));

insert into chart_of_accounts (code, name, type, normal_balance) values
  ('2050', 'Loans Payable', 'liability', 'credit'),
  ('3050', 'Investor Capital', 'equity', 'credit'),
  ('3150', 'Investor Drawings / Redemptions', 'equity', 'debit'),
  ('6100', 'Interest Expense', 'expense', 'debit')
on conflict (code) do nothing;
