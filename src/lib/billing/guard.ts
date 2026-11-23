import "server-only";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { canManageMembers, type OrgRole } from "@/lib/orgs-shared";

export class BillingError extends Error {}

/**
 * For billing Server Actions: the caller must be signed in and an owner/admin of the org.
 * Membership is checked with the user's own session (RLS); billing state is then read
 * with the admin client because `subscriptions` writes are server-only.
 */
export async function requireBillingManager(orgId: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const { data: membership } = await supabase
    .from("memberships")
    .select("role, organizations (id, name, slug)")
    .eq("org_id", orgId)
    .eq("user_id", user.sub)
    .maybeSingle();
  const org = membership?.organizations;
  if (!membership || !org || !canManageMembers(membership.role as OrgRole)) {
    throw new BillingError("Only owners and admins can manage billing.");
  }

  const admin = createAdminClient();
  const { data: sub, error } = await admin
    .from("subscriptions")
    .select("plan, status, stripe_customer_id, stripe_subscription_id")
    .eq("org_id", orgId)
    .single();
  if (error) throw new BillingError("Couldn't load billing details. Please try again.");

  return { user, org, sub, admin };
}
