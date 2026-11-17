# Recapwell

> Meeting notes in. Clear recap out.

**Recapwell** is a portfolio demo of a multi-tenant B2B SaaS. A team member pastes meeting notes and gets a summary, action items with owners and a ready-to-send follow-up email. Everything belongs to a **workspace (organization)** with members, roles, a Stripe subscription and feature modules that can be switched on or off per workspace.

Recapwell is a fictional product. Stripe runs in **test mode** only.

## Stack

- **Next.js 16** (App Router, Cache Components / Partial Prerendering, `proxy.ts`) + TypeScript
- **Tailwind CSS v4**
- **Supabase**: Auth (email + password, Google OAuth), Postgres, Row Level Security, SQL migrations, pgTAP tests
- **Stripe**: subscriptions per workspace, Checkout, Customer Portal, webhooks *(step 4)*
- **Claude API**: recap generation with validated JSON output *(step 6)*
- **Vitest** + **GitHub Actions** *(step 9)*, **Vercel** deploy

## Roadmap

- [x] 1. Next.js scaffold + Supabase Auth (email/password, Google, protected `/app`)
- [x] 2. Database schema, Row Level Security, seed data, pgTAP tests
- [ ] 3. Organizations UI: onboarding, workspace switcher, members, invites, roles
- [ ] 4. Stripe: Checkout per workspace, webhooks → `subscriptions`
- [ ] 5. Billing page + Customer Portal
- [ ] 6. AI recaps (Claude API) + plan and usage gating
- [ ] 7. Modules: follow-up email, action tracker, export
- [ ] 8. Workspace dashboard + super-admin dashboard
- [ ] 9. Vitest, GitHub Actions CI, audit log in the UI
- [ ] 10. Deploy, demo accounts, landing + pricing

## Multi-tenancy model

```
auth.users ─┬─ profiles
            └─ memberships (role: owner | admin | member) ─── organizations
                                                               ├─ subscriptions (plan: free | team)
                                                               ├─ org_modules (module on/off)
                                                               ├─ invitations
                                                               ├─ recaps ── action_items
                                                               ├─ usage_counters
                                                               └─ audit_log
```

| Plan | Members | Recaps / month | Modules |
|---|---|---|---|
| Free | 3 | 10 | Summary |
| Team ($29/mo) | 15 | 300 | Summary, Follow-up email, Action tracker, Export |

**Tenant isolation is enforced in Postgres, not only in the UI.**

- Every org-scoped table has RLS policies based on `private.is_member(org_id)` and `private.has_role(org_id, roles)`. These helpers are `security definer`, which avoids the classic recursive-policy trap on `memberships`.
- Column-level grants limit what a signed-in user can change at all (e.g. `profiles.is_super_admin`, `subscriptions` and `usage_counters` are never writable from the client).
- Billing, usage and recap creation are written only by the server with the Supabase secret key (Stripe webhooks, the Claude route).
- Multi-row operations with business rules are Postgres functions (RPCs): `create_organization`, `accept_invitation`, `set_member_role`, `remove_member`, `get_invitation`, `org_enabled_modules`. Rules include "a workspace always keeps an owner", "admins can't touch owners", "an invite only works for its email" and plan member limits.
- Key actions are written to `audit_log`.

The isolation is covered by **pgTAP tests** in `supabase/tests/database/`: another tenant's data, plan upgrades, self-promotion to owner or super admin, and guest access all fail.

## How auth works

| File | What it does |
|---|---|
| `src/proxy.ts` | Runs before every request (Next 16's replacement for `middleware.ts`). Refreshes the Supabase session cookie and redirects guests away from `/app/*`. |
| `src/lib/supabase/server.ts` | Server client + `getCurrentUser()` using `getClaims()` (verified JWT). |
| `src/lib/supabase/client.ts` | Browser client for Client Components. |
| `src/app/auth/actions.ts` | Server Actions: sign in, sign up, Google OAuth, sign out. |
| `src/app/auth/callback/route.ts` | Exchanges the PKCE code from Google / email-confirmation links for a session. |
| `src/lib/safe-redirect.ts` | Validates `?next=` so it can't be used as an open redirect. |

## Local setup

Requires Node 20+ and Docker Desktop.

```bash
npm install
npm run db:start             # local Supabase in Docker (first run downloads images)
cp .env.example .env.local   # paste the Project URL and Publishable key printed by db:start
npm run db:reset             # apply migrations + seed demo data
npm run dev                  # http://localhost:3000
```

Local URLs: Studio http://127.0.0.1:54323 · Mailpit (test emails) http://127.0.0.1:54324

### Demo accounts (password `password123`)

| Email | Role |
|---|---|
| alice@recapwell.test | Owner of **Acme Studio** (Team) |
| carol@recapwell.test | Member of Acme Studio; has a pending invite to Bluebird |
| bob@recapwell.test | Owner of **Bluebird Labs** (Free) |
| admin@recapwell.test | Super admin, no workspace |

### Database scripts

```bash
npm run db:start   # start local Supabase
npm run db:stop    # stop it
npm run db:reset   # re-create the DB from migrations + seed
npm run db:test    # run the pgTAP tests (after db:reset)
npm run db:types   # regenerate src/lib/database.types.ts from the local schema
```

New schema change: `npx supabase migration new <name>`, write SQL, then `npm run db:reset && npm run db:test`.

### Google sign-in (optional)

1. Google Cloud Console → APIs & Services → Credentials → **OAuth client ID** (Web application).
2. Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback` (for local Supabase: `http://127.0.0.1:54321/auth/v1/callback`).
3. Supabase → Authentication → Providers → **Google** (or `[auth.external.google]` in `supabase/config.toml` locally).

## Scripts

```bash
npm run dev     # dev server
npm run build   # production build
npm run lint    # ESLint
```
