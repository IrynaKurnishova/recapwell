"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { getStripe } from "@/lib/stripe";
import { BillingError, requireBillingManager } from "@/lib/billing/guard";
import { TEAM_PRICE_LOOKUP_KEYS, type BillingInterval } from "@/lib/billing/plans";
import { syncSubscription } from "@/lib/billing/sync";

export type BillingState = { error?: string } | undefined;

/** Runs a billing action and turns expected failures into a message for the form. */
async function attempt(body: () => Promise<void>): Promise<BillingState> {
  try {
    await body();
    return undefined;
  } catch (err) {
    if (err instanceof BillingError) return { error: err.message };
    // redirect() works by throwing; let Next.js handle it.
    if (err && typeof err === "object" && "digest" in err) throw err;
    console.error("[billing]", err);
    return { error: "Stripe didn't accept that request. Please try again." };
  }
}

const billingUrl = (slug: string) => `${env.siteUrl()}/app/${slug}/billing`;

export async function startCheckout(_prev: BillingState, formData: FormData): Promise<BillingState> {
  const orgId = String(formData.get("orgId"));
  const interval = String(formData.get("interval")) as BillingInterval;
  if (!(interval in TEAM_PRICE_LOOKUP_KEYS)) return { error: "Choose monthly or yearly billing." };

  let checkoutUrl = "";
  const result = await attempt(async () => {
    const { user, org, sub, admin } = await requireBillingManager(orgId);
    if (sub.plan === "team") redirect(`/app/${org.slug}/billing`);

    const stripe = getStripe();

    // One Stripe customer per workspace (not per user).
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
    if (!prices[0]) throw new BillingError("Stripe prices are missing. Run `npm run stripe:setup` first.");

    // Hosted Checkout. The webhook (not this redirect) is what actually upgrades the plan.
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: orgId,
      line_items: [{ price: prices[0].id, quantity: 1 }],
      subscription_data: { metadata: { org_id: orgId } },
      metadata: { org_id: orgId },
      allow_promotion_codes: true,
      success_url: `${billingUrl(org.slug)}?checkout=success`,
      cancel_url: `${billingUrl(org.slug)}?checkout=cancelled`,
    });
    if (!session.url) throw new BillingError("Stripe didn't return a checkout link. Please try again.");
    checkoutUrl = session.url;
  });

  if (checkoutUrl) redirect(checkoutUrl);
  return result;
}

/** Stripe Customer Portal: payment method, invoices, monthly ↔ yearly, cancel. */
export async function openBillingPortal(_prev: BillingState, formData: FormData): Promise<BillingState> {
  let portalUrl = "";
  const result = await attempt(async () => {
    const { org, sub } = await requireBillingManager(String(formData.get("orgId")));
    if (!sub.stripe_customer_id) throw new BillingError("This workspace has no billing history yet.");

    const session = await getStripe().billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: billingUrl(org.slug),
    });
    portalUrl = session.url;
  });

  if (portalUrl) redirect(portalUrl);
  return result;
}

/** Cancel at the end of the paid period, or undo that ("resume"). */
export async function setCancelAtPeriodEnd(_prev: BillingState, formData: FormData): Promise<BillingState> {
  const cancel = formData.get("cancel") === "true";

  return attempt(async () => {
    const { user, org, sub, admin } = await requireBillingManager(String(formData.get("orgId")));
    if (sub.plan !== "team" || !sub.stripe_subscription_id) {
      throw new BillingError("There is no active Team subscription to change.");
    }

    const stripe = getStripe();
    if (cancel) {
      await stripe.subscriptions.update(sub.stripe_subscription_id, { cancel_at_period_end: true });
    } else {
      // The portal may have scheduled the end with `cancel_at`; clear whichever is set.
      const current = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
      await stripe.subscriptions.update(
        sub.stripe_subscription_id,
        current.cancel_at && !current.cancel_at_period_end ? { cancel_at: "" } : { cancel_at_period_end: false },
      );
    }

    // The webhook will sync too; doing it now makes the page update immediately (idempotent).
    await syncSubscription(sub.stripe_subscription_id);
    await admin.from("audit_log").insert({
      org_id: org.id,
      actor_id: user.sub,
      action: cancel ? "billing.cancel_scheduled" : "billing.resumed",
    });
    refresh();
  });
}
