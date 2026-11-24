import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrgContext } from "@/lib/orgs";
import { PLAN_LABELS } from "@/lib/orgs-shared";
import { readStoredOutput } from "@/lib/ai/recap-schema";
import { createClient } from "@/lib/supabase/server";
import { currentPeriodStart } from "@/lib/usage";

export default function OrgOverviewPage({ params }: PageProps<"/app/[orgSlug]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Overview params={params} />
    </Suspense>
  );
}

async function Overview({ params }: Pick<PageProps<"/app/[orgSlug]">, "params">) {
  const { orgSlug } = await params;
  const ctx = await getOrgContext(orgSlug);
  if (!ctx) notFound();

  const supabase = await createClient();
  const period = currentPeriodStart();

  const [recaps, usage, openItems] = await Promise.all([
    supabase
      .from("recaps")
      .select("id, title, created_at, output")
      .eq("org_id", ctx.org.id)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("usage_counters")
      .select("recaps_count")
      .eq("org_id", ctx.org.id)
      .eq("period_start", period)
      .maybeSingle(),
    supabase
      .from("action_items")
      .select("id", { count: "exact", head: true })
      .eq("org_id", ctx.org.id)
      .eq("done", false),
  ]);

  const used = usage.data?.recaps_count ?? 0;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">{ctx.org.name}</h1>
        <p className="mt-1 text-sm text-ink-muted">{PLAN_LABELS[ctx.plan]} plan</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Recaps this month" value={`${used} / ${ctx.monthlyRecaps}`} />
        <Stat label="Open action items" value={String(openItems.count ?? 0)} />
        <Stat label="Plan" value={PLAN_LABELS[ctx.plan]} />
      </div>

      <section>
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-lg font-semibold">Recent recaps</h2>
          <Link href={`/app/${ctx.org.slug}/recaps/new`} className="text-sm font-medium text-brand">
            New recap
          </Link>
        </div>
        {recaps.data && recaps.data.length > 0 ? (
          <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-white">
            {recaps.data.map((recap) => (
              <li key={recap.id}>
                <Link
                  href={`/app/${ctx.org.slug}/recaps/${recap.id}`}
                  className="block px-5 py-4 transition hover:bg-surface"
                >
                  <div className="flex items-baseline justify-between gap-4">
                    <p className="font-medium">{recap.title}</p>
                    <time className="shrink-0 text-xs text-ink-muted" dateTime={recap.created_at}>
                      {new Date(recap.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </time>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-ink-muted">{readStoredOutput(recap.output).summary}</p>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-3 rounded-2xl border border-dashed border-line bg-white p-10 text-center">
            <p className="font-medium">No recaps yet</p>
            <p className="mt-1 text-sm text-ink-muted">Paste meeting notes and Claude turns them into a recap.</p>
            <Link href={`/app/${ctx.org.slug}/recaps/new`} className="btn-primary mt-4 inline-flex">
              New recap
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <p className="text-sm text-ink-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="h-8 w-48 animate-pulse rounded bg-line" />
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-white" />
        ))}
      </div>
    </div>
  );
}
