-- Recapwell demo data (local development only).
-- Applied automatically by `npx supabase db reset` after the migrations.
--
-- All demo users have the password: password123
--
--   alice@recapwell.test  owner of "Acme Studio" (Team plan)
--   carol@recapwell.test  member of "Acme Studio"
--   bob@recapwell.test    owner of "Bluebird Labs" (Free plan)
--   admin@recapwell.test  super admin, no workspace

-- ─────────────────────────────────────────────────────────────
-- Users (profiles are created by the on_auth_user_created trigger)
-- ─────────────────────────────────────────────────────────────
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
select
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
  extensions.crypt('password123', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('full_name', u.full_name), now(), now(),
  '', '', '', ''
from (values
  ('11111111-1111-4111-8111-111111111111'::uuid, 'alice@recapwell.test', 'Alice Moreau'),
  ('22222222-2222-4222-8222-222222222222'::uuid, 'bob@recapwell.test',   'Bob Lindqvist'),
  ('33333333-3333-4333-8333-333333333333'::uuid, 'carol@recapwell.test', 'Carol Rossi'),
  ('44444444-4444-4444-8444-444444444444'::uuid, 'admin@recapwell.test', 'Recapwell Admin')
) as u (id, email, full_name);

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select u.id::text, u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email', now(), now(), now()
from auth.users u
where u.email like '%@recapwell.test';

update public.profiles set is_super_admin = true where email = 'admin@recapwell.test';

-- ─────────────────────────────────────────────────────────────
-- Organizations
-- ─────────────────────────────────────────────────────────────
insert into public.organizations (id, name, slug, created_by) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'Acme Studio',   'acme-studio',   '11111111-1111-4111-8111-111111111111'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'Bluebird Labs', 'bluebird-labs', '22222222-2222-4222-8222-222222222222');

select private.provision_org('aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111');
select private.provision_org('bbbbbbbb-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222');

insert into public.memberships (org_id, user_id, role) values
  ('aaaaaaaa-0000-4000-8000-000000000001', '33333333-3333-4333-8333-333333333333', 'member');

-- Acme is on Team (fake Stripe ids; real ones come from webhooks in step 4).
update public.subscriptions
set plan = 'team', status = 'active',
    stripe_customer_id = 'cus_demo_acme', stripe_subscription_id = 'sub_demo_acme',
    current_period_end = date_trunc('month', now()) + interval '1 month'
where org_id = 'aaaaaaaa-0000-4000-8000-000000000001';

-- Bluebird has an open invite (link: /invite/demo-invite-token-bluebird)
insert into public.invitations (org_id, email, role, token, invited_by) values
  ('bbbbbbbb-0000-4000-8000-000000000002', 'carol@recapwell.test', 'member',
   'demo-invite-token-bluebird', '22222222-2222-4222-8222-222222222222');

-- ─────────────────────────────────────────────────────────────
-- Recaps and action items
-- ─────────────────────────────────────────────────────────────
insert into public.recaps (id, org_id, created_by, title, input_notes, output, model, created_at) values
  ('cccccccc-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   'Website relaunch kickoff',
   'Kickoff with design + dev. Launch target end of Q1. Carol owns the sitemap, Alice books the photo shoot. Open question: CMS choice.',
   '{"summary":"Kickoff for the website relaunch. Target launch is the end of Q1. The CMS choice is still open.","action_items":[{"text":"Draft the new sitemap","owner":"Carol"},{"text":"Book the product photo shoot","owner":"Alice"}],"decisions":["Launch at the end of Q1"],"open_questions":["Which CMS?"]}',
   'demo-seed', now() - interval '3 days'),
  ('cccccccc-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001', '33333333-3333-4333-8333-333333333333',
   'Weekly sync',
   'Sitemap 80% done. Photo shoot moved to next Tuesday. Agreed to use a headless CMS.',
   '{"summary":"Sitemap is almost done, the photo shoot moved to Tuesday, and the team chose a headless CMS.","action_items":[{"text":"Finish the sitemap","owner":"Carol"}],"decisions":["Use a headless CMS"],"open_questions":[]}',
   'demo-seed', now() - interval '1 day'),
  ('dddddddd-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222',
   'Investor update prep',
   'Need MRR chart, churn numbers and hiring plan before Friday. Bob drafts, nobody reviews yet.',
   '{"summary":"Preparing the investor update due Friday: MRR chart, churn numbers and the hiring plan.","action_items":[{"text":"Draft the investor update","owner":"Bob"}],"decisions":[],"open_questions":["Who reviews the draft?"]}',
   'demo-seed', now() - interval '2 days');

insert into public.action_items (recap_id, org_id, text, owner_name, due_date, done) values
  ('cccccccc-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'Draft the new sitemap',        'Carol', current_date + 5, false),
  ('cccccccc-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'Book the product photo shoot', 'Alice', current_date + 2, true),
  ('cccccccc-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001', 'Finish the sitemap',           'Carol', current_date + 3, false),
  ('dddddddd-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000002', 'Draft the investor update',    'Bob',   current_date + 4, false);

insert into public.usage_counters (org_id, period_start, recaps_count) values
  ('aaaaaaaa-0000-4000-8000-000000000001', date_trunc('month', now())::date, 2),
  ('bbbbbbbb-0000-4000-8000-000000000002', date_trunc('month', now())::date, 1);

-- Bluebird (Free) has the Team-only modules switched off, to show the difference.
update public.org_modules set enabled = false
where org_id = 'bbbbbbbb-0000-4000-8000-000000000002' and module_key <> 'summary';
