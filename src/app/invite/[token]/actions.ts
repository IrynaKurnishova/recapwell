"use server";

import { redirect } from "next/navigation";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { dbErrorMessage } from "@/lib/db-errors";

export type AcceptState = { error?: string } | undefined;

export async function acceptInvitation(_prev: AcceptState, formData: FormData): Promise<AcceptState> {
  const token = String(formData.get("token") ?? "");
  if (!(await getCurrentUser())) redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);

  const supabase = await createClient();
  const { data: orgId, error } = await supabase.rpc("accept_invitation", { p_token: token });
  if (error) return { error: dbErrorMessage(error) };

  // Now that the user is a member, RLS lets them read the workspace.
  const { data: org } = await supabase.from("organizations").select("slug").eq("id", orgId).single();
  redirect(org ? `/app/${org.slug}` : "/app");
}
