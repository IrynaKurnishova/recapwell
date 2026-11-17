-- Tenant isolation and role rules.
-- Run with: npx supabase test db   (needs `npx supabase db reset` first: uses seed data)
begin;
create extension if not exists pgtap with schema extensions;

select plan(41);

-- ─────────────────────────────────────────────────────────────
-- Helpers: act as a given user, like a request with their JWT would.
-- ─────────────────────────────────────────────────────────────
create schema tests;
grant usage on schema tests to anon, authenticated;

create function tests.login_as(p_email text) returns void language plpgsql as $$
declare v_id uuid;
begin
  reset role;
  select id into v_id from auth.users where email = p_email;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_id, 'role', 'authenticated', 'email', p_email)::text, true);
  execute 'set local role authenticated';
end $$;

create function tests.login_anon() returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  execute 'set local role anon';
end $$;

create function tests.logout() returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
end $$;

grant execute on all functions in schema tests to anon, authenticated;
-- pgTAP keeps its state in temp tables; let the test roles write to them.
grant all on all tables in schema pg_temp to anon, authenticated;
grant all on all sequences in schema pg_temp to anon, authenticated;


-- ─────────────────────────────────────────────────────────────
-- Isolation: Bob (Bluebird owner) sees nothing of Acme
-- ─────────────────────────────────────────────────────────────
select tests.login_as('bob@recapwell.test');

select results_eq($$ select slug from organizations $$, $$ values ('bluebird-labs') $$,
  'Bob sees only his own organization');
select is((select count(*) from recaps where org_id = 'aaaaaaaa-0000-4000-8000-000000000001')::int, 0, 'Bob sees no Acme recaps');
select is((select count(*) from recaps)::int, 1, 'Bob sees his own recap');
select is((select count(*) from action_items where org_id = 'aaaaaaaa-0000-4000-8000-000000000001')::int, 0, 'Bob sees no Acme action items');
select is((select count(*) from subscriptions)::int, 1, 'Bob sees only his own subscription');
select is((select count(*) from memberships where org_id = 'aaaaaaaa-0000-4000-8000-000000000001')::int, 0, 'Bob sees no Acme memberships');
select is((select count(*) from org_modules where org_id = 'aaaaaaaa-0000-4000-8000-000000000001')::int, 0, 'Bob sees no Acme modules');
select is((select count(*) from usage_counters where org_id = 'aaaaaaaa-0000-4000-8000-000000000001')::int, 0, 'Bob sees no Acme usage');
select results_eq($$ select email from profiles $$, $$ values ('bob@recapwell.test') $$,
  'Bob sees no profiles outside his workspaces');
select is((select count(*) from invitations)::int, 1, 'Bob (owner) sees his workspace invitations');

-- Writes that must fail
select throws_ok($$ insert into recaps (org_id, title, input_notes) values ('aaaaaaaa-0000-4000-8000-000000000001', 'x', 'x') $$,
  '42501', null, 'Clients cannot create recaps directly (server only)');
select throws_ok($$ insert into memberships (org_id, user_id, role) values ('aaaaaaaa-0000-4000-8000-000000000001', auth.uid(), 'owner') $$,
  '42501', null, 'Bob cannot add himself to Acme');
select throws_ok($$ insert into invitations (org_id, email) values ('aaaaaaaa-0000-4000-8000-000000000001', 'evil@example.com') $$,
  '42501', null, 'Bob cannot invite people to Acme');
select throws_ok($$ update subscriptions set plan = 'team' $$,
  '42501', null, 'Bob cannot upgrade his own plan by writing to subscriptions');
select throws_ok($$ update profiles set is_super_admin = true where id = auth.uid() $$,
  '42501', null, 'Bob cannot make himself a super admin');
select throws_ok($$ select * from stripe_events $$,
  '42501', null, 'Stripe events are not readable by users');
select throws_ok($$ select public.create_organization('Second', 'bob-second') $$,
  'P0001', 'You already own a Free workspace. Upgrade it to Team to create another.',
  'Free plan: one owned workspace per user');
select results_eq($$ select * from public.org_enabled_modules('bbbbbbbb-0000-4000-8000-000000000002') $$,
  $$ values ('summary'::text) $$, 'Free workspace gets only the Summary module');
select is((select count(*) from public.org_enabled_modules('aaaaaaaa-0000-4000-8000-000000000001'))::int, 0,
  'Bob cannot read Acme modules via RPC');

-- ─────────────────────────────────────────────────────────────
-- Roles inside Acme: Carol is a member, Alice the owner
-- ─────────────────────────────────────────────────────────────
select tests.login_as('carol@recapwell.test');

select is((select count(*) from recaps)::int, 2, 'Carol sees both Acme recaps');
select is((select count(*) from profiles)::int, 2, 'Carol sees herself and Alice');
select is((select count(*) from invitations)::int, 0, 'Members cannot see invitations');
update organizations set name = 'Hacked' where id = 'aaaaaaaa-0000-4000-8000-000000000001';
update org_modules set enabled = false where org_id = 'aaaaaaaa-0000-4000-8000-000000000001' and module_key = 'export';
select throws_ok($$ select public.set_member_role('aaaaaaaa-0000-4000-8000-000000000001', auth.uid(), 'owner') $$,
  '42501', null, 'A member cannot promote herself');
select lives_ok($$ update action_items set done = true where org_id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  'Members can tick off action items');

select tests.logout();
select is((select name from organizations where id = 'aaaaaaaa-0000-4000-8000-000000000001'), 'Acme Studio', 'Member rename was ignored by RLS');
select is((select enabled from org_modules where org_id = 'aaaaaaaa-0000-4000-8000-000000000001' and module_key = 'export'), true,
  'Member module toggle was ignored by RLS');

select tests.login_as('alice@recapwell.test');
select lives_ok($$ update org_modules set enabled = false where org_id = 'aaaaaaaa-0000-4000-8000-000000000001' and module_key = 'export' $$,
  'Owner can switch a module off');
select is((select count(*) from public.org_enabled_modules('aaaaaaaa-0000-4000-8000-000000000001'))::int, 3,
  'Switched-off module disappears from enabled modules');
select throws_ok($$ update org_modules set enabled = false where org_id = 'aaaaaaaa-0000-4000-8000-000000000001' and module_key = 'summary' $$,
  '23514', null, 'Summary module cannot be switched off');
select throws_ok($$ select public.set_member_role('aaaaaaaa-0000-4000-8000-000000000001', auth.uid(), 'admin') $$,
  'P0001', 'A workspace needs at least one owner.', 'The last owner cannot step down');
select throws_ok($$ select public.remove_member('aaaaaaaa-0000-4000-8000-000000000001', auth.uid()) $$,
  'P0001', 'A workspace needs at least one owner.', 'The last owner cannot leave');
select lives_ok($$ insert into invitations (org_id, email, role) values ('aaaaaaaa-0000-4000-8000-000000000001', 'dan@example.com', 'admin') $$,
  'Owner can invite a new admin');
select throws_ok($$ insert into invitations (org_id, email, role) values ('aaaaaaaa-0000-4000-8000-000000000001', 'eve@example.com', 'owner') $$,
  '23514', null, 'Ownership cannot be handed out by invite');
select lives_ok($$ select public.set_member_role('aaaaaaaa-0000-4000-8000-000000000001', '33333333-3333-4333-8333-333333333333', 'admin') $$,
  'Owner can promote a member to admin');
select is((select count(*) from audit_log where action = 'member.role_changed')::int, 1, 'Role change is written to the audit log');

-- ─────────────────────────────────────────────────────────────
-- Invitations
-- ─────────────────────────────────────────────────────────────
select throws_ok($$ select public.accept_invitation('demo-invite-token-bluebird') $$,
  '42501', 'This invitation was sent to a different email address.', 'An invite only works for its email');

select tests.login_anon();
select results_eq($$ select org_name, role::text from public.get_invitation('demo-invite-token-bluebird') $$,
  $$ values ('Bluebird Labs'::text, 'member'::text) $$, 'Guests can preview an invite by token');
select throws_ok($$ select * from organizations $$, '42501', null, 'Guests cannot read any table');

select tests.login_as('carol@recapwell.test');
select lives_ok($$ select public.accept_invitation('demo-invite-token-bluebird') $$, 'Carol accepts the Bluebird invite');
select is((select count(*) from recaps where org_id = 'bbbbbbbb-0000-4000-8000-000000000002')::int, 1, 'After joining, Carol sees Bluebird recaps');
select lives_ok($$ select public.create_organization('Carol Co', 'carol-co') $$, 'Carol can create her own workspace');

select tests.logout();
select * from finish();
rollback;
