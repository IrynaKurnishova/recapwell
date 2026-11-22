import type { Enums } from "@/lib/database.types";

// Pure billing rules (no Stripe/Supabase calls) so they're easy to unit test in step 9.

export type BillingInterval = "month" | "year";
type SubscriptionStatus = Enums<"subscription_status">;
type PlanTier = Enums<"plan_tier">;

/** Stripe prices are looked up by these keys, so no price IDs live in env vars. */
export const TEAM_PRICE_LOOKUP_KEYS: Record<BillingInterval, string> = {
  month: "recapwell_team_monthly",
  year: "recapwell_team_yearly",
};

export const TEAM_PRICES_USD: Record<BillingInterval, number> = { month: 29, year: 290 };

const DB_STATUSES: SubscriptionStatus[] = [
  "active", "trialing", "past_due", "canceled", "incomplete", "incomplete_expired", "unpaid", "paused",
];

// past_due keeps Team features while Stripe retries the card (grace period).
const TEAM_STATUSES = new Set<string>(["active", "trialing", "past_due"]);

type SubscriptionLike = {
  status: string;
  items: { data: { price: { lookup_key: string | null }; current_period_end?: number }[] };
};

export function isTeamPrice(lookupKey: string | null | undefined) {
  return Object.values(TEAM_PRICE_LOOKUP_KEYS).includes(lookupKey ?? "");
}

/**
 * Maps a Stripe subscription to what we store in `subscriptions`.
 * Anything that isn't a paying Team subscription falls back to Free, which is always "active"
 * so Free features (e.g. the Summary module) keep working.
 */
export function planFromSubscription(sub: SubscriptionLike): { plan: PlanTier; status: SubscriptionStatus } {
  const hasTeamPrice = sub.items.data.some((item) => isTeamPrice(item.price.lookup_key));
  if (hasTeamPrice && TEAM_STATUSES.has(sub.status)) {
    return { plan: "team", status: sub.status as SubscriptionStatus };
  }
  return { plan: "free", status: "active" };
}

/** Since API 2025-03-31 the billing period lives on subscription items. */
export function periodEnd(sub: SubscriptionLike): string | null {
  const ends = sub.items.data.map((i) => i.current_period_end ?? 0).filter(Boolean);
  return ends.length ? new Date(Math.max(...ends) * 1000).toISOString() : null;
}

export function isKnownStatus(status: string): status is SubscriptionStatus {
  return (DB_STATUSES as string[]).includes(status);
}
