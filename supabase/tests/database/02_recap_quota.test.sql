-- Monthly recap quota: reserve_recap / release_recap.
-- Run with: npx supabase test db   (needs `npx supabase db reset` first: uses seed data)
begin;
create extension if not exists pgtap with schema extensions;

select plan(10);

-- Seed: Bluebird is on Free (10 recaps/month) and has used 1 this month.
create temp table t_ids as select
  'bbbbbbbb-0000-4000-8000-000000000002'::uuid as bluebird,
  date_trunc('month', now() at time zone 'utc')::date as period;
grant select on t_ids to authenticated, service_role;

create function pg_temp.used() returns int language sql as $$
  select recaps_count from public.usage_counters u, t_ids
  where u.org_id = t_ids.bluebird and u.period_start = t_ids.period
$$;

-- ── Users can't call the quota functions ─────────────────────
select set_config('request.jwt.claims',
  json_build_object('sub', (select id from auth.users where email = 'bob@recapwell.test'),
                    'role', 'authenticated')::text, true);
set local role authenticated;

select throws_ok(
  $$ select public.reserve_recap((select bluebird from t_ids)) $$,
  '42501', null, 'a signed-in user cannot reserve recaps directly');
select throws_ok(
  $$ select public.release_recap((select bluebird from t_ids), (select period from t_ids)) $$,
  '42501', null, 'a signed-in user cannot release recaps directly');

reset role;
select set_config('request.jwt.claims', '', true);

-- ── The server can ───────────────────────────────────────────
set local role service_role;

select is(public.reserve_recap((select bluebird from t_ids)), (select period from t_ids),
  'reserve returns the current period');
reset role;
select is(pg_temp.used(), 2, 'reserve adds one recap to the counter');

set local role service_role;
select public.release_recap((select bluebird from t_ids), (select period from t_ids));
reset role;
select is(pg_temp.used(), 1, 'release gives the recap back');

-- Fill Bluebird up to its Free limit (10).
update public.usage_counters set recaps_count = 9
where org_id = (select bluebird from t_ids) and period_start = (select period from t_ids);

set local role service_role;
select isnt(public.reserve_recap((select bluebird from t_ids)), null, 'the 10th recap of the month is allowed');
select is(public.reserve_recap((select bluebird from t_ids)), null, 'the 11th recap is refused on Free');
reset role;
select is(pg_temp.used(), 10, 'a refused reserve does not change the counter');

-- Release never goes below zero.
update public.usage_counters set recaps_count = 0
where org_id = (select bluebird from t_ids) and period_start = (select period from t_ids);
set local role service_role;
select public.release_recap((select bluebird from t_ids), (select period from t_ids));
reset role;
select is(pg_temp.used(), 0, 'release never makes the counter negative');

-- A new month starts from scratch: no counter row yet → reserve creates it with 1.
delete from public.usage_counters where org_id = (select bluebird from t_ids);
set local role service_role;
select public.reserve_recap((select bluebird from t_ids));
reset role;
select is(pg_temp.used(), 1, 'the first recap of a month creates the counter');

select * from finish();
rollback;
