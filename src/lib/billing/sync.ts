import "server-only";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { isTeamPrice, periodEnd, planFromSubscription } from "./plans";

/**
 * Re-reads a subscription from Stripe and writes its state to `subscriptions`.
 *
 * We always fetch the latest version instead of trusting the webhook payload, because
 * Stripe doesn't guarantee event order. Running this twice gives the same result,
 * so retries and duplicate events are harmless.
 */
export async function syncSubscription(subscriptionId: string) {
  const stripe = getStripe();
  const admin = createAdminClient();
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;

  const orgId = sub.metadata.org_id ?? (await orgIdForCustomer(customerId));
  if (!orgId) {
    console.warn(`[billing] No workspace for subscription ${sub.id} / customer ${customerId}`);
    return;
  }

  const { data: current, error: readError } = await admin
    .from("subscriptions")
    .select("plan, stripe_subscription_id")
    .eq("org_id", orgId)
    .single();
  if (readError) throw readError;

  // An old subscription ending must not downgrade a workspace that already has a newer one.
  const { plan, status } = planFromSubscription(sub);
  if (current.stripe_subscription_id && current.stripe_subscription_id !== sub.id && plan === "free") {
    return;
  }

  const teamItem = sub.items.data.find((item) => isTeamPrice(item.price.lookup_key));
  const ended = plan === "free";

  const { error } = await admin
    .from("subscriptions")
    .update({
      plan,
      status,
      stripe_customer_id: customerId,
      stripe_subscription_id: ended ? null : sub.id,
      stripe_price_id: ended ? null : (teamItem?.price.id ?? null),
      current_period_end: ended ? null : periodEnd(sub),
      cancel_at_period_end: ended ? false : sub.cancel_at_period_end,
    })
    .eq("org_id", orgId);
  if (error) throw error;

  if (current.plan !== plan) {
    await admin.from("audit_log").insert({
      org_id: orgId,
      action: "billing.plan_changed",
      meta: { from: current.plan, to: plan, stripe_status: sub.status, subscription_id: sub.id },
    });
  }
}

async function orgIdForCustomer(customerId: string) {
  const { data } = await createAdminClient()
    .from("subscriptions")
    .select("org_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  return data?.org_id ?? null;
}

/** Pulls the subscription id out of the events we care about. */
export function subscriptionIdFromEvent(event: Stripe.Event): string | null {
  const idOf = (value: string | { id: string } | null | undefined) =>
    typeof value === "string" ? value : (value?.id ?? null);

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      return session.mode === "subscription" ? idOf(session.subscription) : null;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      return event.data.object.id;
    case "invoice.paid":
    case "invoice.payment_failed":
      return idOf(event.data.object.parent?.subscription_details?.subscription);
    default:
      return null;
  }
}
