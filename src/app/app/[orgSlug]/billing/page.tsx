import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getOrgContext } from "@/lib/orgs";
import { canManageMembers, PLAN_LABELS } from "@/lib/orgs-shared";
import { TEAM_PRICES_USD } from "@/lib/billing/plans";
import { createClient } from "@/lib/supabase/server";
import { UpgradeButton } from "./UpgradeButton";

export const metadata: Metadata = { title: "Billing · Recapwell" };

type Props = PageProps<"/app/[orgSlug]/billing">;

export default function BillingPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-white" />}>
      <Billing params={params} searchParams={searchParams} />
    </Suspense>
  );
}

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  trialing: "Trial",
  past_due: "Payment failed — retrying",
};

async function Billing({ params, searchParams }: Props) {
  const [{ orgSlug }, query] = await Promise.all([params, searchParams]);
  const ctx = await getOrgContext(orgSlug);
  if (!ctx) notFound();

  const supabase = await createClient();
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("plan, status, current_period_end, cancel_at_period_end")
    .eq("org_id", ctx.org.id)
    .single();

  const canManage = canManageMembers(ctx.org.role);
  const isTeam = sub?.plan === "team";
  const checkout = query.checkout;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Billing</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Stripe sandbox: no real money. Use card <code className="rounded bg-white px-1">4242 4242 4242 4242</code>, any future
          date and any CVC.
        </p>
      </div>

      {checkout === "success" && !isTeam && (
        <p role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Payment received. Your plan switches to Team as soon as Stripe confirms it — refresh in a few seconds.
        </p>
      )}
      {checkout === "success" && isTeam && (
        <p role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          You&apos;re on Team now. Thanks for upgrading!
        </p>
      )}
      {checkout === "cancelled" && (
        <p role="status" className="rounded-lg bg-surface px-4 py-3 text-sm text-ink-muted">
          Checkout was cancelled. Nothing was charged.
        </p>
      )}

      <section className="rounded-2xl border border-line bg-white p-6">
        <p className="text-sm text-ink-muted">Current plan</p>
        <div className="mt-1 flex flex-wrap items-baseline gap-3">
          <p className="text-2xl font-semibold">{PLAN_LABELS[sub?.plan ?? "free"]}</p>
          {isTeam && sub && (
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                sub.status === "past_due" ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-700"
              }`}
            >
              {STATUS_LABELS[sub.status] ?? sub.status}
            </span>
          )}
        </div>
        <p className="mt-2 text-sm text-ink-muted">
          {ctx.maxMembers} members · {ctx.monthlyRecaps} recaps per month
          {isTeam && sub?.current_period_end && (
            <>
              {" · "}
              {sub.cancel_at_period_end ? "ends" : "renews"} on{" "}
              {new Date(sub.current_period_end).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </>
          )}
        </p>
      </section>

      {!isTeam && (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Upgrade to Team</h2>
          <ul className="grid gap-2 text-sm text-ink-muted sm:grid-cols-3">
            <li>✓ Up to 15 members</li>
            <li>✓ 300 recaps per month</li>
            <li>✓ Follow-up emails, action tracker, export</li>
          </ul>

          {canManage ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <PlanOption price={`$${TEAM_PRICES_USD.month}`} period="per month">
                <UpgradeButton orgId={ctx.org.id} interval="month" label="Upgrade monthly" />
              </PlanOption>
              <PlanOption price={`$${TEAM_PRICES_USD.year}`} period="per year · 2 months free">
                <UpgradeButton orgId={ctx.org.id} interval="year" label="Upgrade yearly" />
              </PlanOption>
            </div>
          ) : (
            <p className="rounded-lg bg-surface px-4 py-3 text-sm text-ink-muted">
              Ask an owner or admin of this workspace to upgrade.
            </p>
          )}
        </section>
      )}

      {isTeam && (
        <p className="text-sm text-ink-muted">
          Managing payment methods, invoices and cancellation (Stripe Customer Portal) arrives in step 5.
        </p>
      )}
    </div>
  );
}

function PlanOption({ price, period, children }: { price: string; period: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-5">
      <p>
        <span className="text-3xl font-semibold">{price}</span>{" "}
        <span className="text-sm text-ink-muted">{period}</span>
      </p>
      {children}
    </div>
  );
}
