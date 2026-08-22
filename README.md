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
- No user accounts or authentication — anyone with the link can edit.
