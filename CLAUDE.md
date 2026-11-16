@AGENTS.md

# Recapwell — notes for Claude Code

Portfolio SaaS demo: Next.js 16 + Supabase + Stripe (test mode) + Claude API. Fictional product, see README for the roadmap.

## Conventions
- Next.js 16 with `cacheComponents: true`. Anything that reads cookies/headers/searchParams (incl. the Supabase session) must sit inside `<Suspense>`; keep the rest of the page a static shell.
- Route guard lives in `src/proxy.ts` (not `middleware.ts`). Still re-check the user on the server in protected pages and in every Server Action / Route Handler.
- Use `getCurrentUser()` from `src/lib/supabase/server.ts` (`getClaims()`), never `getSession()` on the server.
- Create a new Supabase server client per request. Browser code only uses `src/lib/supabase/client.ts`.
- Secrets (Stripe secret key, webhook secret, Anthropic key, Supabase service role) are server-only: no `NEXT_PUBLIC_` prefix, never import them into Client Components.
- Plan gating and usage limits are enforced on the server, never only in the UI.
- Tailwind v4 tokens live in `src/app/globals.css` (`brand`, `ink`, `ink-muted`, `line`, `surface`) plus `.btn-primary`, `.btn-secondary`, `.input`.
- Run `npm run lint` and `npm run build` before calling a step done.
