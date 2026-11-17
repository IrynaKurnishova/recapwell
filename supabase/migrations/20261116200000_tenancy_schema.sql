-- Recapwell — multi-tenant core schema
-- Everything a customer creates belongs to an organization (workspace).
-- Row Level Security policies live in the next migration.

-- ─────────────────────────────────────────────────────────────
-- Schemas
-- ─────────────────────────────────────────────────────────────
-- `private` is not exposed through the Data API, so helper functions
-- placed here cannot be called directly by clients via /rest/v1/rpc.
create schema if not exists private;
grant usage on schema private to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────
-- Types
-- ─────────────────────────────────────────────────────────────
create type public.org_role as enum ('owner', 'admin', 'member');

-- Order matters: plans are compared with >= (free < team).
create type public.plan_tier as enum ('free', 'team');

-- Mirrors Stripe subscription statuses.
create type public.subscription_status as enum (
  'active', 'trialing', 'past_due', 'canceled', 'incomplete',
  'incomplete_expired', 'unpaid', 'paused'
);

-- ─────────────────────────────────────────────────────────────
-- Reference data: plans and modules
-- ─────────────────────────────────────────────────────────────
create table public.plan_limits (
  plan            public.plan_tier primary key,
  max_members     int not null check (max_members > 0),
  monthly_recaps  int not null check (monthly_recaps >= 0)
);

insert into public.plan_limits (plan, max_members, monthly_recaps) values
  ('free', 3, 10),
  ('team', 15, 300);

create table public.modules (
  key          text primary key,
  name         text not null,
  description  text not null,
  min_plan     public.plan_tier not null default 'team',
  sort_order   int not null default 0
);

insert into public.modules (key, name, description, min_plan, sort_order) values
  ('summary',        'Summary',        'Summary and action items for every recap.',         'free', 1),
  ('followup_email', 'Follow-up email', 'Ready-to-send follow-up email with tone presets.',   'team', 2),
  ('action_tracker', 'Action tracker', 'Action items as a checklist with owners and dates.', 'team', 3),
  ('export',         'Export',         'Export recaps as Markdown or PDF.',                  'team', 4);

-- ─────────────────────────────────────────────────────────────
-- Users
-- ─────────────────────────────────────────────────────────────
create table public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  email           text not null,
  full_name       text check (char_length(full_name) <= 120),
  avatar_url      text,
  is_super_admin  boolean not null default false,
  created_at      timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- Tenancy
-- ─────────────────────────────────────────────────────────────
create table public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) between 1 and 80),
  -- Used in URLs: /app/<slug>
  slug        text not null unique check (slug ~ '^[a-z0-9]([a-z0-9-]{0,46}[a-z0-9])?$'),
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);

create table public.memberships (
  org_id      uuid not null references public.organizations (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        public.org_role not null default 'member',
  created_at  timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index memberships_user_id_idx on public.memberships (user_id);

create table public.invitations (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations (id) on delete cascade,
  email        text not null check (email = lower(btrim(email)) and email like '%_@_%'),
  -- Ownership is never handed out by invite; promote an admin instead.
  role         public.org_role not null default 'member' check (role <> 'owner'),
  -- 256-bit random token used in the invite link.
  token        text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  invited_by   uuid references auth.users (id) on delete set null default auth.uid(),
  expires_at   timestamptz not null default now() + interval '7 days',
  accepted_at  timestamptz,
  accepted_by  uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now()
);
-- One open invite per email per organization.
create unique index invitations_open_email_idx
  on public.invitations (org_id, email) where accepted_at is null;

-- ─────────────────────────────────────────────────────────────
-- Billing state (written only by the server / Stripe webhooks)
-- ─────────────────────────────────────────────────────────────
create table public.subscriptions (
  org_id                  uuid primary key references public.organizations (id) on delete cascade,
  plan                    public.plan_tier not null default 'free',
  status                  public.subscription_status not null default 'active',
  stripe_customer_id      text unique,
  stripe_subscription_id  text unique,
  stripe_price_id         text,
  current_period_end      timestamptz,
  cancel_at_period_end    boolean not null default false,
  updated_at              timestamptz not null default now()
);

-- Processed Stripe webhook events, so a retried event is applied only once.
create table public.stripe_events (
  event_id      text primary key,
  type          text not null,
  processed_at  timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- Modules (feature toggles per organization)
-- ─────────────────────────────────────────────────────────────
create table public.org_modules (
  org_id      uuid not null references public.organizations (id) on delete cascade,
  module_key  text not null references public.modules (key) on delete cascade,
  enabled     boolean not null default true,
  updated_at  timestamptz not null default now(),
  primary key (org_id, module_key),
  -- Summary is the core feature and can't be switched off.
  check (module_key <> 'summary' or enabled)
);

-- ─────────────────────────────────────────────────────────────
-- Product data
-- ─────────────────────────────────────────────────────────────
create table public.recaps (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations (id) on delete cascade,
  created_by     uuid references auth.users (id) on delete set null,
  title          text not null check (char_length(title) between 1 and 200),
  input_notes    text not null check (char_length(input_notes) <= 50000),
  output         jsonb,
  model          text,
  input_tokens   int,
  output_tokens  int,
  created_at     timestamptz not null default now(),
  -- Lets action_items reference (id, org_id) so an item can't point at another org's recap.
  unique (id, org_id)
);
create index recaps_org_created_idx on public.recaps (org_id, created_at desc);

create table public.action_items (
  id          uuid primary key default gen_random_uuid(),
  recap_id    uuid not null,
  org_id      uuid not null,
  text        text not null check (char_length(text) between 1 and 500),
  owner_name  text check (char_length(owner_name) <= 120),
  due_date    date,
  done        boolean not null default false,
  created_at  timestamptz not null default now(),
  foreign key (recap_id, org_id) references public.recaps (id, org_id) on delete cascade
);
create index action_items_org_open_idx on public.action_items (org_id) where not done;
create index action_items_recap_idx on public.action_items (recap_id);

create table public.usage_counters (
  org_id        uuid not null references public.organizations (id) on delete cascade,
  period_start  date not null,  -- first day of the month
  recaps_count  int not null default 0 check (recaps_count >= 0),
  primary key (org_id, period_start)
);

create table public.audit_log (
  id          bigint generated always as identity primary key,
  org_id      uuid references public.organizations (id) on delete cascade,
  actor_id    uuid references auth.users (id) on delete set null,
  action      text not null,
  meta        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index audit_log_org_created_idx on public.audit_log (org_id, created_at desc);

-- ─────────────────────────────────────────────────────────────
-- Helper functions (used by RLS policies)
-- security definer: they read memberships without triggering memberships'
-- own RLS policy, which would otherwise recurse.
-- ─────────────────────────────────────────────────────────────
create function private.is_member(p_org uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = p_org and m.user_id = (select auth.uid())
  );
$$;

create function private.has_role(p_org uuid, p_roles public.org_role[])
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = p_org and m.user_id = (select auth.uid()) and m.role = any (p_roles)
  );
$$;

-- True when the current user and p_user are in at least one common organization.
create function private.shares_org_with(p_user uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships mine
    join public.memberships theirs on theirs.org_id = mine.org_id
    where mine.user_id = (select auth.uid()) and theirs.user_id = p_user
  );
$$;

create function public.is_super_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select p.is_super_admin from public.profiles p where p.id = (select auth.uid())),
    false
  );
$$;

create function private.log(p_org uuid, p_action text, p_meta jsonb default '{}'::jsonb)
returns void
language sql security definer set search_path = ''
as $$
  insert into public.audit_log (org_id, actor_id, action, meta)
  values (p_org, (select auth.uid()), p_action, coalesce(p_meta, '{}'::jsonb));
$$;

-- Gives a new organization its owner, a Free subscription and default modules.
create function private.provision_org(p_org uuid, p_owner uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.memberships (org_id, user_id, role) values (p_org, p_owner, 'owner');
  insert into public.subscriptions (org_id) values (p_org);
  insert into public.org_modules (org_id, module_key, enabled)
    select p_org, m.key, true from public.modules m;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- Profiles are created automatically for every new auth user
-- ─────────────────────────────────────────────────────────────
create function private.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create function private.handle_user_email_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.profiles set email = coalesce(new.email, '') where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function private.handle_user_email_change();

-- Users who signed up before this migration.
insert into public.profiles (id, email)
  select u.id, coalesce(u.email, '') from auth.users u
  on conflict (id) do nothing;

-- ─────────────────────────────────────────────────────────────
-- RPCs: multi-row operations with business rules.
-- Clients call these instead of writing memberships directly.
-- ─────────────────────────────────────────────────────────────

-- Create a workspace; the caller becomes its owner.
-- Free plan rule: a user can own only one Free workspace.
create function public.create_organization(p_name text, p_slug text)
returns public.organizations
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_org public.organizations;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if exists (
    select 1
    from public.memberships m
    join public.subscriptions s on s.org_id = m.org_id
    where m.user_id = v_uid and m.role = 'owner' and s.plan = 'free'
  ) then
    raise exception 'You already own a Free workspace. Upgrade it to Team to create another.'
      using errcode = 'P0001', hint = 'free_workspace_limit';
  end if;

  begin
    insert into public.organizations (name, slug, created_by)
    values (btrim(p_name), lower(btrim(p_slug)), v_uid)
    returning * into v_org;
  exception when unique_violation then
    raise exception 'This workspace URL is already taken.' using errcode = '23505', hint = 'slug_taken';
  end;

  perform private.provision_org(v_org.id, v_uid);
  perform private.log(v_org.id, 'organization.created', jsonb_build_object('name', v_org.name));
  return v_org;
end;
$$;

-- Public details of an invite, for the "Join <org>" page. The token itself is the secret.
create function public.get_invitation(p_token text)
returns table (org_name text, org_slug text, email text, role public.org_role, expired boolean, accepted boolean)
language sql stable security definer set search_path = ''
as $$
  select o.name, o.slug, i.email, i.role, i.expires_at < now(), i.accepted_at is not null
  from public.invitations i
  join public.organizations o on o.id = i.org_id
  where i.token = p_token;
$$;

-- Accept an invite. The signed-in user's email must match the invite.
create function public.accept_invitation(p_token text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid      uuid := auth.uid();
  v_email    text;
  v_inv      public.invitations;
  v_members  int;
  v_max      int;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select lower(u.email) into v_email from auth.users u where u.id = v_uid;

  select * into v_inv from public.invitations where token = p_token for update;
  if not found then
    raise exception 'Invitation not found.' using errcode = 'P0002', hint = 'invite_not_found';
  end if;
  if v_inv.accepted_at is not null then
    raise exception 'This invitation has already been used.' using errcode = 'P0001', hint = 'invite_used';
  end if;
  if v_inv.expires_at < now() then
    raise exception 'This invitation has expired.' using errcode = 'P0001', hint = 'invite_expired';
  end if;
  if v_inv.email <> v_email then
    raise exception 'This invitation was sent to a different email address.'
      using errcode = '42501', hint = 'invite_wrong_email';
  end if;

  if not exists (select 1 from public.memberships where org_id = v_inv.org_id and user_id = v_uid) then
    select count(*) into v_members from public.memberships where org_id = v_inv.org_id;
    select pl.max_members into v_max
      from public.subscriptions s join public.plan_limits pl on pl.plan = s.plan
      where s.org_id = v_inv.org_id;
    if v_members >= coalesce(v_max, 0) then
      raise exception 'This workspace has reached its member limit.' using errcode = 'P0001', hint = 'member_limit';
    end if;

    insert into public.memberships (org_id, user_id, role) values (v_inv.org_id, v_uid, v_inv.role);
  end if;

  update public.invitations set accepted_at = now(), accepted_by = v_uid where id = v_inv.id;
  perform private.log(v_inv.org_id, 'member.joined', jsonb_build_object('role', v_inv.role));
  return v_inv.org_id;
end;
$$;

-- Change a member's role.
-- Owners can do anything; admins can manage members and admins but not owners.
-- An organization always keeps at least one owner.
create function public.set_member_role(p_org uuid, p_user uuid, p_role public.org_role)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_caller_role  public.org_role;
  v_target_role  public.org_role;
begin
  select role into v_caller_role from public.memberships where org_id = p_org and user_id = auth.uid();
  if v_caller_role is null or v_caller_role = 'member' then
    raise exception 'Only owners and admins can change roles.' using errcode = '42501';
  end if;

  select role into v_target_role from public.memberships where org_id = p_org and user_id = p_user for update;
  if v_target_role is null then
    raise exception 'Member not found.' using errcode = 'P0002';
  end if;

  if v_caller_role = 'admin' and (v_target_role = 'owner' or p_role = 'owner') then
    raise exception 'Only owners can grant or change the owner role.' using errcode = '42501';
  end if;

  if v_target_role = 'owner' and p_role <> 'owner' and (
    select count(*) from public.memberships where org_id = p_org and role = 'owner'
  ) = 1 then
    raise exception 'A workspace needs at least one owner.' using errcode = 'P0001', hint = 'last_owner';
  end if;

  update public.memberships set role = p_role where org_id = p_org and user_id = p_user;
  perform private.log(p_org, 'member.role_changed',
    jsonb_build_object('user_id', p_user, 'from', v_target_role, 'to', p_role));
end;
$$;

-- Remove a member, or leave the organization (p_user = yourself).
create function public.remove_member(p_org uuid, p_user uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid          uuid := auth.uid();
  v_caller_role  public.org_role;
  v_target_role  public.org_role;
begin
  select role into v_caller_role from public.memberships where org_id = p_org and user_id = v_uid;
  select role into v_target_role from public.memberships where org_id = p_org and user_id = p_user for update;

  if v_caller_role is null then
    raise exception 'You are not a member of this workspace.' using errcode = '42501';
  end if;
  if v_target_role is null then
    raise exception 'Member not found.' using errcode = 'P0002';
  end if;

  if p_user <> v_uid then
    if v_caller_role = 'member' then
      raise exception 'Only owners and admins can remove members.' using errcode = '42501';
    end if;
    if v_caller_role = 'admin' and v_target_role = 'owner' then
      raise exception 'Admins can''t remove owners.' using errcode = '42501';
    end if;
  end if;

  if v_target_role = 'owner' and (
    select count(*) from public.memberships where org_id = p_org and role = 'owner'
  ) = 1 then
    raise exception 'A workspace needs at least one owner.' using errcode = 'P0001', hint = 'last_owner';
  end if;

  delete from public.memberships where org_id = p_org and user_id = p_user;
  perform private.log(p_org, case when p_user = v_uid then 'member.left' else 'member.removed' end,
    jsonb_build_object('user_id', p_user));
end;
$$;

-- Effective modules for an organization: switched on AND included in its plan.
create function public.org_enabled_modules(p_org uuid)
returns setof text
language sql stable security definer set search_path = ''
as $$
  select om.module_key
  from public.org_modules om
  join public.modules m on m.key = om.module_key
  join public.subscriptions s on s.org_id = om.org_id
  where om.org_id = p_org
    and private.is_member(p_org)
    and om.enabled
    and s.plan >= m.min_plan
    and s.status in ('active', 'trialing', 'past_due')
  order by m.sort_order;
$$;

-- ─────────────────────────────────────────────────────────────
-- Function privileges
-- Postgres lets PUBLIC execute new functions by default; lock that down.
-- ─────────────────────────────────────────────────────────────
revoke execute on all functions in schema private from public, anon;
grant execute on function
  private.is_member(uuid),
  private.has_role(uuid, public.org_role[]),
  private.shares_org_with(uuid)
to authenticated;

revoke execute on function
  public.is_super_admin(),
  public.create_organization(text, text),
  public.get_invitation(text),
  public.accept_invitation(text),
  public.set_member_role(uuid, uuid, public.org_role),
  public.remove_member(uuid, uuid),
  public.org_enabled_modules(uuid)
from public, anon;

grant execute on function
  public.is_super_admin(),
  public.create_organization(text, text),
  public.get_invitation(text),
  public.accept_invitation(text),
  public.set_member_role(uuid, uuid, public.org_role),
  public.remove_member(uuid, uuid),
  public.org_enabled_modules(uuid)
to authenticated;

-- The invite page can show "Join <org>" before the visitor signs in.
grant execute on function public.get_invitation(text) to anon;
