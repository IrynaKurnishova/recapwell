-- Recapwell — Row Level Security
--
-- Model:
--   * Every org-scoped row is visible only to members of that org.
--   * Owners/admins manage the org; members use it.
--   * Billing, usage, recaps creation and Stripe events are written only by the
--     server with the secret (service_role) key, which bypasses RLS.
--   * Multi-row changes (create org, join, change role, remove member) go through
--     the RPCs in the previous migration.
--
-- Privileges are two layers: table/column GRANTs decide which operations are
-- possible at all, and RLS policies decide which rows.

-- ─────────────────────────────────────────────────────────────
-- 1. Enable RLS everywhere
-- ─────────────────────────────────────────────────────────────
alter table public.plan_limits     enable row level security;
alter table public.modules         enable row level security;
alter table public.profiles        enable row level security;
alter table public.organizations   enable row level security;
alter table public.memberships     enable row level security;
alter table public.invitations     enable row level security;
alter table public.subscriptions   enable row level security;
alter table public.stripe_events   enable row level security;
alter table public.org_modules     enable row level security;
alter table public.recaps          enable row level security;
alter table public.action_items    enable row level security;
alter table public.usage_counters  enable row level security;
alter table public.audit_log       enable row level security;

-- ─────────────────────────────────────────────────────────────
-- 2. Grants: guests get nothing; signed-in users get read access plus a few
--    explicitly listed writes. service_role keeps full access.
-- ─────────────────────────────────────────────────────────────
revoke all on all tables in schema public from anon;
revoke insert, update, delete, truncate, references, trigger on all tables in schema public from authenticated;
grant select on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

-- Column-level write permissions
grant update (full_name, avatar_url) on public.profiles      to authenticated;
grant update (name)                  on public.organizations to authenticated;
grant delete                         on public.organizations to authenticated;
grant insert (org_id, email, role)   on public.invitations   to authenticated;
grant delete                         on public.invitations   to authenticated;
grant update (enabled)               on public.org_modules   to authenticated;
grant delete                         on public.recaps        to authenticated;
grant update (done, owner_name, due_date) on public.action_items to authenticated;

-- stripe_events is server-only: not even readable by users.
revoke select on public.stripe_events from authenticated;

-- ─────────────────────────────────────────────────────────────
-- 3. Policies
-- ─────────────────────────────────────────────────────────────

-- Reference data: readable by any signed-in user.
create policy "plan_limits: readable" on public.plan_limits
  for select to authenticated using (true);

create policy "modules: readable" on public.modules
  for select to authenticated using (true);

-- Profiles: yourself + people you share a workspace with.
create policy "profiles: read self and teammates" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or private.shares_org_with(id));

create policy "profiles: update self" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Organizations
create policy "organizations: members read" on public.organizations
  for select to authenticated
  using (private.is_member(id));

create policy "organizations: owners and admins rename" on public.organizations
  for update to authenticated
  using (private.has_role(id, array['owner', 'admin']::public.org_role[]))
  with check (private.has_role(id, array['owner', 'admin']::public.org_role[]));

create policy "organizations: owners delete" on public.organizations
  for delete to authenticated
  using (private.has_role(id, array['owner']::public.org_role[]));

-- Memberships: read-only for clients; changes go through RPCs.
create policy "memberships: members read" on public.memberships
  for select to authenticated
  using (private.is_member(org_id));

-- Invitations: managed by owners/admins. Invitees use get_invitation / accept_invitation.
create policy "invitations: owners and admins read" on public.invitations
  for select to authenticated
  using (private.has_role(org_id, array['owner', 'admin']::public.org_role[]));

create policy "invitations: owners and admins create" on public.invitations
  for insert to authenticated
  with check (
    private.has_role(org_id, array['owner', 'admin']::public.org_role[])
    and invited_by = (select auth.uid())
  );

create policy "invitations: owners and admins revoke" on public.invitations
  for delete to authenticated
  using (private.has_role(org_id, array['owner', 'admin']::public.org_role[]));

-- Subscriptions and usage: members can see their org's plan and usage.
create policy "subscriptions: members read" on public.subscriptions
  for select to authenticated
  using (private.is_member(org_id));

create policy "usage_counters: members read" on public.usage_counters
  for select to authenticated
  using (private.is_member(org_id));

-- Modules: members read, owners/admins toggle.
create policy "org_modules: members read" on public.org_modules
  for select to authenticated
  using (private.is_member(org_id));

create policy "org_modules: owners and admins toggle" on public.org_modules
  for update to authenticated
  using (private.has_role(org_id, array['owner', 'admin']::public.org_role[]))
  with check (private.has_role(org_id, array['owner', 'admin']::public.org_role[]));

-- Recaps: members read; the author or an owner/admin can delete.
-- Creating a recap goes through the server (quota + Claude call).
create policy "recaps: members read" on public.recaps
  for select to authenticated
  using (private.is_member(org_id));

create policy "recaps: author or admins delete" on public.recaps
  for delete to authenticated
  using (
    private.is_member(org_id)
    and (
      created_by = (select auth.uid())
      or private.has_role(org_id, array['owner', 'admin']::public.org_role[])
    )
  );

-- Action items: any member can tick them off or reassign.
create policy "action_items: members read" on public.action_items
  for select to authenticated
  using (private.is_member(org_id));

create policy "action_items: members update" on public.action_items
  for update to authenticated
  using (private.is_member(org_id))
  with check (private.is_member(org_id));

-- Audit log: owners/admins read their org's log.
create policy "audit_log: owners and admins read" on public.audit_log
  for select to authenticated
  using (private.has_role(org_id, array['owner', 'admin']::public.org_role[]));

-- stripe_events: RLS on, no policies → only service_role can touch it.

-- ─────────────────────────────────────────────────────────────
-- 4. Keep updated_at fresh
-- ─────────────────────────────────────────────────────────────
create function private.touch_updated_at()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger subscriptions_touch before update on public.subscriptions
  for each row execute function private.touch_updated_at();
create trigger org_modules_touch before update on public.org_modules
  for each row execute function private.touch_updated_at();
