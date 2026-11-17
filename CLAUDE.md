@AGENTS.md

# Recapwell — notes for Claude Code

Portfolio demo of a multi-tenant B2B SaaS: Next.js 16 + Supabase + Stripe (test mode) + Claude API. Fictional product; see README for the roadmap and data model.

## Next.js
- Next.js 16 with `cacheComponents: true`. Anything that reads cookies/headers/searchParams (incl. the Supabase session) must sit inside `<Suspense>`; keep the rest of the page a static shell.
- Route guard lives in `src/proxy.ts` (not `middleware.ts`). Still re-check the user on the server in protected pages and in every Server Action / Route Handler.
- Use `getCurrentUser()` from `src/lib/supabase/server.ts` (`connection()` + `getClaims()`), never `getSession()` on the server.
- Create a new Supabase server client per request. Browser code only uses `src/lib/supabase/client.ts`.
- Tailwind v4 tokens live in `src/app/globals.css` (`brand`, `ink`, `ink-muted`, `line`, `surface`) plus `.btn-primary`, `.btn-secondary`, `.input`.

## Database (Supabase, local via Docker)
- Schema changes only as new files in `supabase/migrations/` (`npx supabase migration new <name>`). Never edit a migration that is already committed.
- Every org-scoped table has `org_id` and RLS. Policies use `private.is_member(org_id)` / `private.has_role(org_id, roles)`; never query `memberships` inside a `memberships` policy (recursion).
- New tables: enable RLS, add policies, and grant only the columns users may write. Default is read-only for `authenticated`, nothing for `anon`.
- Multi-row writes with rules (orgs, memberships, invites) go through `security definer` RPCs with `set search_path = ''`.
- `subscriptions`, `usage_counters`, `stripe_events` and recap inserts are server-only (secret key). Plan gating and usage limits are enforced on the server, never only in the UI.
- After a schema change: `npm run db:reset && npm run db:test`, then `npm run db:types`. Add a pgTAP test for every new policy.
- Seed users (password `password123`): alice (Acme owner, Team), carol (Acme member), bob (Bluebird owner, Free), admin (super admin).

## Secrets
- Stripe secret key, webhook secret, Anthropic key, Supabase secret key: server-only, no `NEXT_PUBLIC_` prefix, never imported into Client Components, never committed.

## Done means
- `npm run lint`, `npm run build` and `npm run db:test` pass.
