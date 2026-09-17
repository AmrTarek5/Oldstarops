# OldStar Operations & Returns App

Private internal tool for OldStar (modeled on "The Solutionn"). Single Next.js
app (frontend + API routes), Supabase (Postgres) for storage, deployed on
Vercel — everything on free tiers.

## Stack

- **Framework:** Next.js 16 (App Router, TypeScript, Tailwind)
- **Database:** Supabase (Postgres), free tier
- **Hosting:** Vercel, free tier
- **Scheduled jobs:** Vercel Cron, hitting `/api/cron/*` routes
- **Auth:** single shared admin login (cookie session, no OAuth) — this is a
  private single-tenant tool, not a SaaS
- **Integrations:** Shopify Admin API, Bosta API, Anthropic (Claude) API for
  AI photo review of returns

## Setup

1. **Supabase**: create a free project, then run the SQL in
   `supabase/migrations/0001_init.sql` in the SQL editor. Copy the project URL,
   anon key, and service role key.
2. **Shopify**: in the OldStar store admin, go to Settings → Apps → Develop
   apps, create a custom app with Admin API access (read/write orders,
   products, inventory), install it, and copy the Admin API access token.
3. **Bosta**: get an API key from the Bosta merchant dashboard.
   ⚠️ The Bosta client (`src/lib/bosta.ts`) was written without access to
   Bosta's live API docs (no network access in the build sandbox) — the
   endpoint paths, auth header format, and delivery status codes are
   best-effort based on commonly documented Bosta v2 patterns and are marked
   `VERIFY` in that file. Confirm them against your Bosta merchant API
   reference before relying on the delivery sync or return-pickup automation.
4. **Anthropic**: get an API key from the Claude console for the AI photo
   review feature.
5. Copy `.env.example` to `.env.local` and fill in all values, including a
   random `AUTH_SECRET` (32+ chars) and a `CRON_SECRET` you'll also set on
   Vercel's Cron Jobs config.
6. `npm install && npm run dev`

## Deploying

- Push to Vercel, set the same env vars in the Vercel project settings.
- `vercel.json` defines hourly sync schedules. **Vercel's free Hobby tier
  currently limits cron jobs to once per day** — hourly schedules require a
  Pro plan. On Hobby, either change the schedules to `"0 4 * * *"` (once
  daily) or trigger the sync routes yourself (e.g. a free external cron
  pinger like cron-job.org hitting the route URL with the `CRON_SECRET`
  bearer token) at whatever cadence you need. Check Vercel's current cron
  limits before deploying, since these change over time.
- The cron routes check a `CRON_SECRET` bearer token (set by Vercel
  automatically for its own cron invocations, or manually if triggering
  another way) — never leave them open.

## Structure

- `src/app/(app)/...` — authenticated admin screens (dashboard, operations
  hub, returns admin, settings)
- `src/app/returns/[orderLookup]` — public customer-facing returns portal
- `src/app/api/cron/*` — scheduled sync jobs (Shopify orders/products, Bosta
  deliveries)
- `src/app/api/public/*` — endpoints the public returns portal calls
- `src/lib/shopify.ts`, `src/lib/bosta.ts` — API clients
- `supabase/migrations/` — SQL schema
