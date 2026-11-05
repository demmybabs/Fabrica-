# Fabrica — production line ERP (scaffold)

A React/Vite scaffold for a production-line business (e.g. a food/snack
factory) covering five linked modules — Supply, Production, Inventory,
Sales, Customers — plus an Overview dashboard with a date-range filter.

## How the modules connect

- **Supply**: log deliveries from suppliers (material, quantity, unit, cost,
  amount paid). The materials ledger tracks what's been received, its
  weighted-average cost, and what's still owed to each supplier.
- **Production**: log a run that consumes raw materials (deducted from the
  running material total, not lot-tracked) and yields one or more SKUs —
  including different pack sizes or flavours from the same batch. Cost is
  allocated across outputs by pack weight, not split evenly per unit.
- **Inventory**: automatically computed — finished goods on hand
  (produced minus sold minus spoiled) at weighted-average production cost,
  plus remaining raw materials and their value.
- **Sales**: recording a sale deducts from inventory automatically and
  shows cost, revenue, and margin per line using the SKU's current
  average production cost.
- **Customers**: a profile per customer (gender, profession, segment) so
  you can see best customers and spending patterns by group.
- **Overview**: pulls headline metrics from all five, filterable by date
  range (revenue, COGS, gross margin, inventory value, payables, active
  customers).

## Units of measure

Weight, volume, and count units convert automatically (kg to g, l to ml,
etc). Add your own units (e.g. a 50kg sack) under **Settings**.

## Data

Everything is stored in the browser's local storage — there's no backend
yet. This is a scaffold meant to prove out the data model and flow; a real
deployment would move this to a proper database (Postgres/Supabase is a
natural fit) with auth per branch/user.

## Run locally

```
npm install
npm run dev
```

## Deploy

This is a static Vite build (`npm run build` produces `dist/`), so it
deploys cleanly to Vercel or Netlify. If you hit upload issues in the
browser, pushing the repo via GitHub Desktop and importing it in Vercel
tends to be the smoothest path — the same approach used for the Farmco
app.

## What's simplified for the scaffold, worth revisiting

- Raw materials are deducted from a running total, not tracked lot-by-lot
  — so you can't yet trace a specific finished unit back to the exact
  supply delivery that fed it, only to the material in aggregate.
- Cost-per-unit on a sale uses the SKU's *current* weighted-average cost,
  not the cost at the moment that specific unit was produced.
- No multi-branch support yet — this is single-location.
- Inside an organisation there are only two roles (admin / member). The
  older per-department roles (supply, sales, etc.) are only used in the
  local-storage demo mode.

## Going live with Supabase (shared, multi-organisation)

By default Fabrica stores everything in the browser's local storage — fine
for solo testing. Connected to Supabase it becomes a multi-organisation
web app: every business gets its own, fully separate Fabrica, with its own
people; a **super admin** console sits above them all.

### How it works

- **Super admin** (you): creates organisations, invites each one's first
  admin, tracks plan/billing status, can suspend or delete an organisation,
  and can **Open** any organisation's Fabrica to see and edit its data.
- **Organisation admin**: uses every module, edits Settings, and invites or
  removes people on the **Team** page.
- **Member**: uses every module. (Settings and Team are hidden.)
- People sign in with **Google** or **email + password**. An invitation is
  just "this email may join this organisation": when someone signs in with
  that (confirmed) email they are attached to it automatically.
- Data separation is enforced inside the database (row-level security on
  an `org_id` column), not just in the screens.

### Setup

1. Create a project at [supabase.com](https://supabase.com). In the SQL
   editor run `src/data/schema.sql`, then each `migration_v20` … `v27`
   file if your project predates them (a brand-new project only needs
   `schema.sql`), then finally **`src/data/migration_v28.sql`**.
   Before running v28, change `CHANGE_ME@gmail.com` on its first line to
   your own email. You become super admin and admin of the first
   organisation, which receives all the data you already have.
2. **Authentication → Providers → Email**: keep **Confirm email ON**.
   This is required — invitations are matched to confirmed emails, and
   turning confirmation off would let anyone claim an invited address.
3. **Authentication → Providers → Google**: create a "Web application"
   OAuth client in Google Cloud Console, add Supabase's callback URL
   (`https://<project-ref>.supabase.co/auth/v1/callback`, shown on that
   Supabase page) as an authorised redirect URI, then paste the Client ID
   and Secret into Supabase and enable it.
4. **Authentication → URL Configuration**: set **Site URL** to your Vercel
   address and add it (and `http://localhost:5173` for local work) under
   **Redirect URLs**. For Vercel preview deployments add
   `https://*-<your-team>.vercel.app/**` too.
5. **Authentication → Providers**: switch **Anonymous Sign-Ins off**
   (after the new version is deployed).
6. Copy `.env.example` to `.env` and fill in the project URL and anon key
   from Supabase → Settings → API. On Vercel add the same two variables
   under Project Settings → Environment Variables and redeploy (Vite bakes
   them in at build time).
7. Open the app, sign in with the email from step 1, and you land in the
   super-admin console. Create an organisation, enter the first admin's
   email, and tell them to sign in.

### Notes

- No emails are sent for invitations; the person is told to sign in with
  the invited address. Email confirmation and password-reset emails come
  from Supabase's built-in mailer, which is rate-limited — set up a custom
  SMTP sender under Authentication → SMTP before onboarding many people.
- Billing fields (plan, status, trial end, renewal date, notes) are a
  record you maintain by hand. No payment provider is connected and billing
  status does not lock anyone out; use **Suspend** for that.
- The Settings page is hidden from members in the screens; the database
  itself lets any member of an organisation update that organisation's
  settings (needed so everyone can add categories on the fly).
