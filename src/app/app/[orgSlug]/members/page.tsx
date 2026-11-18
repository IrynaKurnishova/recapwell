import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { CopyButton } from "@/components/CopyButton";
import { env } from "@/lib/env";
import { getOrgContext } from "@/lib/orgs";
import { canManageMembers, PLAN_LABELS, ROLE_LABELS, type OrgRole } from "@/lib/orgs-shared";
import { createClient } from "@/lib/supabase/server";
import { InviteForm } from "./InviteForm";
import { MemberRow } from "./MemberRow";
import { RevokeInviteButton } from "./RevokeInviteButton";

export const metadata: Metadata = { title: "Members · Recapwell" };

const ROLE_ORDER: Record<OrgRole, number> = { owner: 0, admin: 1, member: 2 };

export default function MembersPage({ params }: PageProps<"/app/[orgSlug]/members">) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-white" />}>
      <Members params={params} />
    </Suspense>
  );
}

async function Members({ params }: Pick<PageProps<"/app/[orgSlug]/members">, "params">) {
  const { orgSlug } = await params;
  const ctx = await getOrgContext(orgSlug);
  if (!ctx) notFound();

  const myRole = ctx.org.role;
  const canManage = canManageMembers(myRole);
  const supabase = await createClient();

  const { data: memberships, error } = await supabase
    .from("memberships")
    .select("user_id, role, created_at")
    .eq("org_id", ctx.org.id);
  if (error) throw error;

  // RLS lets members see the profiles of people they share a workspace with.
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("id", memberships.map((m) => m.user_id));
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  const members = memberships
    .map((m) => ({ ...m, profile: profileById.get(m.user_id) }))
    .sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.created_at.localeCompare(b.created_at));

  // Only owners/admins can read invitations (RLS); members get an empty list.
  const { data: invitations } = canManage
    ? await supabase
        .from("invitations")
        .select("id, email, role, token, expires_at")
        .eq("org_id", ctx.org.id)
        .is("accepted_at", null)
        .order("created_at", { ascending: false })
    : { data: [] };

  const seatsUsed = members.length;
  const isFull = seatsUsed >= ctx.maxMembers;
  const assignableRoles: OrgRole[] = myRole === "owner" ? ["owner", "admin", "member"] : ["admin", "member"];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Members</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {seatsUsed} of {ctx.maxMembers} seats used on the {PLAN_LABELS[ctx.plan]} plan
          </p>
        </div>
        <p className="text-sm text-ink-muted">
          Your role: <span className="font-medium text-ink">{ROLE_LABELS[myRole]}</span>
        </p>
      </div>

      <ul className="divide-y divide-line rounded-2xl border border-line bg-white">
        {members.map((m) => {
          const isMe = m.user_id === ctx.userId;
          const touchesOwner = m.role === "owner" && myRole !== "owner";
          return (
            <MemberRow
              key={`${m.user_id}-${m.role}`}
              orgId={ctx.org.id}
              userId={m.user_id}
              name={m.profile?.full_name ?? ""}
              email={m.profile?.email ?? "Unknown user"}
              role={m.role}
              isMe={isMe}
              canEditRole={canManage && !touchesOwner}
              canRemove={isMe || (canManage && !touchesOwner)}
              assignableRoles={assignableRoles}
            />
          );
        })}
      </ul>

      {canManage && (
        <section className="flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-semibold">Invite people</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Create a link and send it to your teammate. Only the invited email address can use it.
            </p>
          </div>

          <div className="rounded-2xl border border-line bg-white p-5">
            {isFull ? (
              <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                All {ctx.maxMembers} seats are taken. Remove someone or upgrade to add more people.
              </p>
            ) : null}
            <InviteForm orgId={ctx.org.id} disabled={isFull} />
          </div>

          {invitations && invitations.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold">Pending invites</h3>
              <ul className="mt-2 divide-y divide-line rounded-2xl border border-line bg-white">
                {invitations.map((inv) => {
                  const expired = new Date(inv.expires_at) < new Date();
                  return (
                    <li key={inv.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 text-sm">
                      <span className="min-w-0 flex-1 truncate font-medium">{inv.email}</span>
                      <span className="text-ink-muted">{ROLE_LABELS[inv.role]}</span>
                      {expired ? (
                        <span className="text-amber-700">Expired</span>
                      ) : (
                        <CopyButton text={`${env.siteUrl()}/invite/${inv.token}`} label="Copy link" />
                      )}
                      <RevokeInviteButton invitationId={inv.id} />
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
