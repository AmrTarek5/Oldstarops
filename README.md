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
2. **Shopify**: since Jan 1, 2026 new custom apps are built in Shopify's Dev
   Dashboard, not the classic Settings → Apps → Develop apps screen. From
   the store admin: Settings → Apps and sales channels → Develop apps →
   "Build apps in Dev Dashboard". Create an app there, add scopes
   `read_orders`, `read_products`, `write_products`, `read_inventory`,
   install it on the OldStar store (must be in the same org as the app),
   then copy the **Client ID** and **Client secret** from the app's Settings
   tab. These apps no longer expose a static Admin API access token — the
   app requests one itself via the OAuth client credentials grant, which
   only works because the app and store share an org. See
   `src/lib/shopify.ts` for the token-fetching logic.
3. **Bosta**: get an API key from
   `https://business.bosta.co/settings/api-integration`. Send it as the raw
   `Authorization` header value with **no `Bearer` prefix** — Bosta support
   confirmed this directly; their own docs page's "Bearer Auth" label is
   wrong for this key type. If a freshly generated key still returns
   `errorCode: 1028 "Invalid authorization token or API key"`, that's not a
   formatting issue on our end — open a support ticket with Bosta, the
   account/key needs enabling on their side.

   The delivery sync (`src/lib/bosta.ts`) has been verified against a real,
   successful `/deliveries/search` call, so the endpoint, auth format, and
   response shape (including real delivery state codes) are confirmed, not
   guessed. What's still unverified: the exact payload for creating a
   return pickup (`createReturnPickup` — a different endpoint, never
   live-tested; OldStar currently creates these manually as "Exchange"
   deliveries from the Bosta dashboard) and the `bosta_fee` field name
   (every delivery seen so far had an empty `pricing` object). Both are
   marked `VERIFY` in that file.
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
