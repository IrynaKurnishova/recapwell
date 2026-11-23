import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { notFound } from "next/navigation";
import { UsageBar } from "@/components/UsageBar";
import { getOrgContext } from "@/lib/orgs";
import { canManageMembers, PLAN_LABELS } from "@/lib/orgs-shared";
import { TEAM_PRICES_USD } from "@/lib/billing/plans";
import { createClient } from "@/lib/supabase/server";
import { CancelButton, PortalButton, ResumeButton, UpgradeButton } from "./BillingButtons";

export const metadata: Metadata = { title: "Billing · Recapwell" };

type Props = PageProps<"/app/[orgSlug]/billing">;

export default function BillingPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-white" />}>
      <Billing params={params} searchParams={searchParams} />
    </Suspense>
  );
}

const STATUS: Record<string, { label: string; tone: string }> = {
  active: { label: "Active", tone: "bg-emerald-50 text-emerald-700" },
  trialing: { label: "Trial", tone: "bg-emerald-50 text-emerald-700" },
  past_due: { label: "Payment failed", tone: "bg-red-50 text-red-700" },
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

async function Billing({ params, searchParams }: Props) {
  const [{ orgSlug }, query] = await Promise.all([params, searchParams]);
  const ctx = await getOrgContext(orgSlug);
  if (!ctx) notFound();

  const supabase = await createClient();
  const monthStart = new Date();
  monthStart.setUTCDate(1);

  const [{ data: sub }, { data: usage }, { count: members }, { data: freeLimits }] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("plan, status, current_period_end, cancel_at_period_end, stripe_customer_id")
      .eq("org_id", ctx.org.id)
      .single(),
    supabase
      .from("usage_counters")
      .select("recaps_count")
      .eq("org_id", ctx.org.id)
      .eq("period_start", monthStart.toISOString().slice(0, 10))
      .maybeSingle(),
    supabase.from("memberships").select("user_id", { count: "exact", head: true }).eq("org_id", ctx.org.id),
    supabase.from("plan_limits").select("max_members, monthly_recaps").eq("plan", "free").single(),
  ]);

  const canManage = canManageMembers(ctx.org.role);
  const isTeam = sub?.plan === "team";
  const pastDue = isTeam && sub?.status === "past_due";
  const ending = isTeam && sub?.cancel_at_period_end;
  const periodEnd = sub?.current_period_end ? formatDate(sub.current_period_end) : null;
  const status = sub ? STATUS[sub.status] : undefined;
  const checkout = query.checkout;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Billing</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Stripe sandbox: no real money. Test card <code className="rounded bg-white px-1">4242 4242 4242 4242</code>,
          any future date, any CVC.
        </p>
      </div>

      {checkout === "success" && (
        <Notice tone={isTeam ? "success" : "info"}>
          {isTeam
            ? "You're on Team now. Thanks for upgrading!"
            : "Payment received. Your plan switches to Team as soon as Stripe confirms it — refresh in a few seconds."}
        </Notice>
      )}
      {checkout === "cancelled" && <Notice tone="info">Checkout was cancelled. Nothing was charged.</Notice>}

      {pastDue && (
        <Notice tone="danger">
          <strong>Your last payment failed.</strong> Stripe will retry the card over the next days and Team features
          stay on meanwhile. {canManage ? "Update the payment method to fix it." : "Ask an owner or admin to update it."}
          {canManage && (
            <div className="mt-3">
              <PortalButton orgId={ctx.org.id} label="Update payment method" />
            </div>
          )}
        </Notice>
      )}

      {ending && periodEnd && (
        <Notice tone="warning">
          <strong>Your Team plan ends on {periodEnd}.</strong> After that the workspace moves to Free (
          {freeLimits?.max_members ?? 3} members, {freeLimits?.monthly_recaps ?? 10} recaps a month, Summary only).
          {canManage && (
            <div className="mt-3">
              <ResumeButton orgId={ctx.org.id} />
            </div>
          )}
        </Notice>
      )}

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-line bg-white p-6">
          <p className="text-sm text-ink-muted">Current plan</p>
          <div className="mt-1 flex flex-wrap items-baseline gap-3">
            <p className="text-2xl font-semibold">{PLAN_LABELS[sub?.plan ?? "free"]}</p>
            {isTeam && status && (
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${status.tone}`}>{status.label}</span>
            )}
          </div>
          {isTeam && periodEnd && (
            <p className="mt-2 text-sm text-ink-muted">
              {ending ? "Ends" : "Renews"} on {periodEnd}
            </p>
          )}
          {!isTeam && <p className="mt-2 text-sm text-ink-muted">Free forever. Upgrade any time.</p>}

          {canManage && sub?.stripe_customer_id && (
            <div className="mt-5 flex flex-wrap gap-3">
              <PortalButton
                orgId={ctx.org.id}
                label={isTeam ? "Manage billing" : "Billing history"}
              />
              {isTeam && !ending && periodEnd && <CancelButton orgId={ctx.org.id} endsOn={periodEnd} />}
            </div>
          )}
          {canManage && isTeam && (
            <p className="mt-3 text-xs text-ink-muted">
              Manage billing opens Stripe: change card, download invoices, switch monthly ↔ yearly.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-5 rounded-2xl border border-line bg-white p-6">
          <p className="text-sm text-ink-muted">Usage this month</p>
          <UsageBar label="Recaps" used={usage?.recaps_count ?? 0} limit={ctx.monthlyRecaps} />
          <UsageBar label="Members" used={members ?? 0} limit={ctx.maxMembers} />
        </div>
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

      {!canManage && isTeam && (
        <p className="text-sm text-ink-muted">Only owners and admins can change billing.</p>
      )}
    </div>
  );
}

const NOTICE_TONES = {
  success: "bg-emerald-50 text-emerald-800",
  info: "bg-surface text-ink-muted",
  warning: "bg-amber-50 text-amber-900",
  danger: "bg-red-50 text-red-800",
};

function Notice({ tone, children }: { tone: keyof typeof NOTICE_TONES; children: ReactNode }) {
  return (
    <div role="status" className={`rounded-lg px-4 py-3 text-sm ${NOTICE_TONES[tone]}`}>
      {children}
    </div>
  );
}

function PlanOption({ price, period, children }: { price: string; period: string; children: ReactNode }) {
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
