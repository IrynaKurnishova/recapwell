"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { dbErrorMessage } from "@/lib/db-errors";
import { env } from "@/lib/env";
import type { OrgRole } from "@/lib/orgs-shared";

export type ActionState = { error?: string; inviteLink?: string; inviteEmail?: string } | undefined;

// Permission checks happen in Postgres (RLS + RPCs). These actions only
// validate input, call the database and turn errors into readable messages.

async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

const INVITABLE_ROLES: OrgRole[] = ["admin", "member"];
const ALL_ROLES: OrgRole[] = ["owner", "admin", "member"];

export async function inviteMember(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const orgId = String(formData.get("orgId"));
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role")) as OrgRole;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address." };
  if (!INVITABLE_ROLES.includes(role)) return { error: "Choose a role." };

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("invitations")
    .insert({ org_id: orgId, email, role })
    .select("token")
    .single();

  if (error) {
    if (error.code === "23505") return { error: "There's already an open invite for this email." };
    return { error: dbErrorMessage(error) };
  }

  refresh();
  return { inviteLink: `${env.siteUrl()}/invite/${data.token}`, inviteEmail: email };
}

export async function revokeInvitation(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("invitations").delete().eq("id", String(formData.get("invitationId")));
  if (error) return { error: dbErrorMessage(error) };
  refresh();
  return undefined;
}

export async function changeRole(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const role = String(formData.get("role")) as OrgRole;
  if (!ALL_ROLES.includes(role)) return { error: "Unknown role." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_member_role", {
    p_org: String(formData.get("orgId")),
    p_user: String(formData.get("userId")),
    p_role: role,
  });
  if (error) return { error: dbErrorMessage(error) };
  refresh();
  return undefined;
}

export async function removeMember(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const userId = String(formData.get("userId"));

  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_member", {
    p_org: String(formData.get("orgId")),
    p_user: userId,
  });
  if (error) return { error: dbErrorMessage(error) };

  // Left the workspace: it's no longer accessible.
  if (userId === user.sub) redirect("/app");

  refresh();
  return undefined;
}
