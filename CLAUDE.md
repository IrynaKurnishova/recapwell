@AGENTS.md

# Recapwell — notes for Claude Code

Portfolio demo of a multi-tenant B2B SaaS: Next.js 16 + Supabase + Stripe (test mode) + Claude API. Fictional product; see README for the roadmap and data model.

## Next.js
- Next.js 16 with `cacheComponents: true`. Anything that reads cookies/headers/searchParams (incl. the Supabase session) must sit inside `<Suspense>`; keep the rest of the page a static shell.
- Route guard lives in `src/proxy.ts` (not `middleware.ts`). Still re-check the user on the server in protected pages and in every Server Action / Route Handler.
- Use `getCurrentUser()` from `src/lib/supabase/server.ts` (`connection()` + `getClaims()`), never `getSession()` on the server.
- Create a new Supabase server client per request. Browser code only uses `src/lib/supabase/client.ts`.
- Tailwind v4 tokens live in `src/app/globals.css` (`brand`, `ink`, `ink-muted`, `line`, `surface`) plus `.btn-primary`, `.btn-secondary`, `.input`.

## App structure
- `/app` redirects to the last workspace (cookie `rw_last_org`, set in the proxy), the first one, or `/app/onboarding`.
- Workspace pages live under `src/app/app/[orgSlug]/`. Start every page with `getOrgContext(slug)` from `src/lib/orgs.ts` and call `notFound()` when it returns null (non-members get the same 404 as a missing workspace).
- `params` is runtime data with Cache Components: read it inside a component wrapped in `<Suspense>`.
- Server Actions validate input, call Supabase as the signed-in user (RLS/RPCs enforce permissions), map errors with `dbErrorMessage()` and call `refresh()`.
- Invites: owners/admins create a link (`/invite/[token]`); emails are not sent yet.

## Database (Supabase, local via Docker)
- Schema changes only as new files in `supabase/migrations/` (`npx supabase migration new <name>`). Never edit a migration that is already committed.
- Every org-scoped table has `org_id` and RLS. Policies use `private.is_member(org_id)` / `private.has_role(org_id, roles)`; never query `memberships` inside a `memberships` policy (recursion).
- New tables: enable RLS, add policies, and grant only the columns users may write. Default is read-only for `authenticated`, nothing for `anon`.
- Multi-row writes with rules (orgs, memberships, invites) go through `security definer` RPCs with `set search_path = ''`.
- `subscriptions`, `usage_counters`, `stripe_events` and recap inserts are server-only (secret key). Plan gating and usage limits are enforced on the server, never only in the UI.
- After a schema change: `npm run db:reset && npm run db:test`, then `npm run db:types`. Add a pgTAP test for every new policy.
- Seed users (password `password123`): alice (Acme owner, Team), carol (Acme member), bob (Bluebird owner, Free), admin (super admin).

## Billing (Stripe sandbox)
- `getStripe()` from `src/lib/stripe.ts` (server-only, lazy). Prices by lookup key from `src/lib/billing/plans.ts`, never hard-coded price IDs.
- Plan state changes only in the webhook via `syncSubscription()` (re-fetch from Stripe, idempotent). Checkout success pages never write billing state.
- `createAdminClient()` (`src/lib/supabase/admin.ts`) bypasses RLS: only for webhooks/billing/super-admin, after your own checks.
- Pure billing rules live in `src/lib/billing/plans.ts` so they can be unit-tested.
- Billing Server Actions start with `requireBillingManager(orgId)` (`src/lib/billing/guard.ts`) and throw `BillingError` for messages shown to the user. A scheduled cancellation can be `cancel_at_period_end` or `cancel_at` — use `scheduledEnd()`.

## MCP server (`mcp/`)
- npm workspace `@recapwell/mcp`; built with esbuild to `mcp/dist/index.js` (`npm run mcp:build`), tests `npm run mcp:test`.
- stdio transport: never write to stdout (it's the protocol) — log with `console.error`.
- Acts as a normal Supabase user (publishable key + email/password from env / `mcp/.env`), never the secret key, so RLS applies.
- Tools depend on the `RecapwellData` interface; add new queries in `supabase-data.ts` and a fake + test in `server.test.ts`. Validate inputs with zod; throw `UserFacingError` for expected "not found" cases.

## Secrets
- Stripe secret key, webhook secret, Anthropic key, Supabase secret key: server-only, no `NEXT_PUBLIC_` prefix, never imported into Client Components, never committed.

## Done means
- `npm run lint`, `npm run build` and `npm run db:test` pass.
