"use server";

import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { canManageMembers, type OrgRole } from "@/lib/orgs-shared";
import { TEAM_PRICE_LOOKUP_KEYS, type BillingInterval } from "@/lib/billing/plans";

export type CheckoutState = { error?: string } | undefined;

export async function startCheckout(_prev: CheckoutState, formData: FormData): Promise<CheckoutState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const orgId = String(formData.get("orgId"));
  const interval = String(formData.get("interval")) as BillingInterval;
  if (!(interval in TEAM_PRICE_LOOKUP_KEYS)) return { error: "Choose monthly or yearly billing." };

  // 1. Authorize with the user's own session (RLS): only owners/admins can buy.
  const supabase = await createClient();
  const { data: membership } = await supabase
    .from("memberships")
    .select("role, organizations (name, slug)")
    .eq("org_id", orgId)
    .eq("user_id", user.sub)
    .maybeSingle();
  const org = membership?.organizations;
  if (!membership || !org || !canManageMembers(membership.role as OrgRole)) {
    return { error: "Only owners and admins can change the plan." };
  }

  // 2. Billing state is server-only, so read/write it with the admin client.
  const admin = createAdminClient();
  const { data: sub, error } = await admin
    .from("subscriptions")
    .select("plan, stripe_customer_id")
    .eq("org_id", orgId)
    .single();
  if (error) return { error: "Couldn't load billing details. Please try again." };
  if (sub.plan === "team") redirect(`/app/${org.slug}/billing`);

  const stripe = getStripe();

  // 3. One Stripe customer per workspace (not per user).
  let customerId = sub.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create(
      { name: org.name, email: user.email as string | undefined, metadata: { org_id: orgId } },
      { idempotencyKey: `recapwell-customer-${orgId}` },
    );
    customerId = customer.id;
    await admin.from("subscriptions").update({ stripe_customer_id: customerId }).eq("org_id", orgId);
  }

  const { data: prices } = await stripe.prices.list({
    lookup_keys: [TEAM_PRICE_LOOKUP_KEYS[interval]],
    active: true,
    limit: 1,
  });
  if (!prices[0]) return { error: "Stripe prices are missing. Run `npm run stripe:setup` first." };

  // 4. Hosted Checkout. The webhook (not this redirect) is what actually upgrades the plan.
  const billingUrl = `${env.siteUrl()}/app/${org.slug}/billing`;
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: orgId,
    line_items: [{ price: prices[0].id, quantity: 1 }],
    subscription_data: { metadata: { org_id: orgId } },
    metadata: { org_id: orgId },
    allow_promotion_codes: true,
    success_url: `${billingUrl}?checkout=success`,
    cancel_url: `${billingUrl}?checkout=cancelled`,
  });

  if (!session.url) return { error: "Stripe didn't return a checkout link. Please try again." };
  redirect(session.url);
}
