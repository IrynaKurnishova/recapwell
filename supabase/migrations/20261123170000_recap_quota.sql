-- Monthly recap quota (step 6).
--
-- The server reserves one recap BEFORE calling Claude and releases it if the call
-- or the save fails. The check and the increment happen in one statement, so two
-- parallel requests can't both take the last recap of the month.
--
-- Only the server (service_role, secret key) may call these. Users can't touch
-- usage_counters directly: they only have read access through RLS.

-- Returns the period (first day of the month, UTC) the recap was counted in,
-- or null when the workspace has used its monthly limit.
create function public.reserve_recap(p_org uuid)
returns date
language plpgsql security definer set search_path = ''
as $$
declare
  v_period date := date_trunc('month', now() at time zone 'utc')::date;
  v_limit  int;
  v_count  int;
begin
  select pl.monthly_recaps into v_limit
  from public.subscriptions s
  join public.plan_limits pl on pl.plan = s.plan
  where s.org_id = p_org;

  if v_limit is null or v_limit <= 0 then
    return null;
  end if;

  insert into public.usage_counters as u (org_id, period_start, recaps_count)
  values (p_org, v_period, 1)
  on conflict (org_id, period_start)
    do update set recaps_count = u.recaps_count + 1
    where u.recaps_count < v_limit
  returning u.recaps_count into v_count;

  if v_count is null then
    return null;
  end if;
  return v_period;
end;
$$;

-- Gives a reserved recap back (Claude failed, or the recap couldn't be saved).
create function public.release_recap(p_org uuid, p_period date)
returns void
language sql security definer set search_path = ''
as $$
  update public.usage_counters
  set recaps_count = greatest(recaps_count - 1, 0)
  where org_id = p_org and period_start = p_period;
$$;

revoke execute on function public.reserve_recap(uuid), public.release_recap(uuid, date)
  from public, anon, authenticated;
grant execute on function public.reserve_recap(uuid), public.release_recap(uuid, date)
  to service_role;
