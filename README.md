# Recapwell

> Meeting notes in. Clear recap out.

**Recapwell** is a portfolio demo of a small B2B SaaS: paste meeting notes and get a summary, action items with owners and a ready-to-send follow-up email. Free users get a few recaps a month; Pro (Stripe subscription) unlocks more recaps and extra features.

Recapwell is a fictional product. Stripe runs in **test mode** only.

## Stack

- **Next.js 16** (App Router, Cache Components / Partial Prerendering, `proxy.ts`) + TypeScript
- **Tailwind CSS v4**
- **Supabase**: Auth (email + password, Google OAuth), Postgres, Row Level Security
- **Stripe**: Checkout, Customer Portal, webhooks *(step 3)*
- **Claude API**: recap generation, gated by plan *(step 5)*
- **Vercel** deploy

## Roadmap

- [x] 1. Next.js scaffold + Supabase Auth (email/password, Google, protected `/app`)
- [ ] 2. DB schema + RLS (profiles, subscriptions, usage, recaps)
- [ ] 3. Stripe products/prices, Checkout, webhook → `subscriptions`
- [ ] 4. Billing page + Customer Portal
- [ ] 5. AI recap feature (Claude API) + plan gating + usage limits
- [ ] 6. Dashboard (usage chart, history) + landing/pricing polish
- [ ] 7. Deploy, screenshots, walkthrough video

## How auth works

| File | What it does |
|---|---|
| `src/proxy.ts` | Runs before every request (Next 16's replacement for `middleware.ts`). Refreshes the Supabase session cookie and redirects guests away from `/app/*`. |
| `src/lib/supabase/server.ts` | Server client (Server Components, Server Actions, Route Handlers) + `getCurrentUser()` using `getClaims()` (verified JWT). |
| `src/lib/supabase/client.ts` | Browser client for Client Components. |
| `src/app/auth/actions.ts` | Server Actions: sign in, sign up, Google OAuth, sign out. |
| `src/app/auth/callback/route.ts` | Exchanges the PKCE code from Google / email-confirmation links for a session. |
| `src/lib/safe-redirect.ts` | Validates `?next=` so it can't be used as an open redirect. |

Pages that read the session render a static shell and stream user-specific parts inside `<Suspense>` (required with Cache Components). Protected pages check the user on the server again, not only in the proxy.

## Local setup

```bash
npm install
cp .env.example .env.local   # then fill in the Supabase values
npm run dev                  # http://localhost:3000
```

### Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. **Project Settings → API Keys**: copy the Project URL and the publishable key (or legacy anon key) into `.env.local`.
3. **Authentication → URL Configuration**:
   - Site URL: `http://localhost:3000` (later your Vercel URL)
   - Redirect URLs: `http://localhost:3000/auth/callback`, and later `https://<your-app>.vercel.app/auth/callback`
4. **Authentication → Sign In / Providers → Email**: for quick local testing you can turn off *Confirm email*. With it on, sign-up sends a confirmation link that lands on `/auth/callback`.

### Google sign-in (optional)

1. Google Cloud Console → APIs & Services → Credentials → **OAuth client ID** (Web application).
2. Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`.
3. Supabase → Authentication → Providers → **Google**: paste the Client ID and secret, enable.

## Scripts

```bash
npm run dev     # dev server
npm run build   # production build
npm run lint    # ESLint
```
