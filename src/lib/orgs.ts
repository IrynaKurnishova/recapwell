import { cache } from "react";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import type { OrgRole, PlanTier } from "@/lib/orgs-shared";

export type MyOrg = { id: string; name: string; slug: string; role: OrgRole };

export type OrgContext = {
  userId: string;
  email: string;
  org: MyOrg;
  orgs: MyOrg[];
  plan: PlanTier;
  maxMembers: number;
  monthlyRecaps: number;
};

/**
 * Workspaces the signed-in user belongs to.
 * RLS guarantees the query can only ever return the user's own memberships' orgs.
 * Wrapped in React cache() so the layout and page share one query per request.
 */
export const getMyOrgs = cache(async (): Promise<MyOrg[]> => {
  const user = await getCurrentUser();
  if (!user) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("memberships")
    .select("role, organizations (id, name, slug)")
    .eq("user_id", user.sub)
    .order("created_at");

  if (error) throw error;

  return data.flatMap(({ role, organizations: org }) => (org ? [{ ...org, role }] : []));
});

/** Everything a page inside /app/[orgSlug] needs. Returns null if the user isn't a member. */
export const getOrgContext = cache(async (slug: string): Promise<OrgContext | null> => {
  const user = await getCurrentUser();
  if (!user) return null;

  const orgs = await getMyOrgs();
  const org = orgs.find((o) => o.slug === slug);
  if (!org) return null;

  const supabase = await createClient();
  const { data: sub } = await supabase.from("subscriptions").select("plan").eq("org_id", org.id).single();
  const plan = sub?.plan ?? "free";
  const { data: limits } = await supabase
    .from("plan_limits")
    .select("max_members, monthly_recaps")
    .eq("plan", plan)
    .single();

  return {
    userId: user.sub,
    email: (user.email as string | undefined) ?? "",
    org,
    orgs,
    plan,
    maxMembers: limits?.max_members ?? 0,
    monthlyRecaps: limits?.monthly_recaps ?? 0,
  };
});
