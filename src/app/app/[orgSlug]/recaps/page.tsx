import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getOrgContext } from "@/lib/orgs";
import { readStoredOutput } from "@/lib/ai/recap-schema";
import { createClient } from "@/lib/supabase/server";
import { recapsUsedThisMonth } from "@/lib/usage";

export const metadata: Metadata = { title: "Recaps · Recapwell" };

type Props = PageProps<"/app/[orgSlug]/recaps">;

export default function RecapsPage({ params }: Props) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-white" />}>
      <Recaps params={params} />
    </Suspense>
  );
}

async function Recaps({ params }: Pick<Props, "params">) {
  const { orgSlug } = await params;
  const ctx = await getOrgContext(orgSlug);
  if (!ctx) notFound();

  const supabase = await createClient();
  const [used, { data: recaps }] = await Promise.all([
    recapsUsedThisMonth(ctx.org.id),
    supabase
      .from("recaps")
      .select("id, title, created_at, output, action_items (id, done)")
      .eq("org_id", ctx.org.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  const left = Math.max(ctx.monthlyRecaps - used, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Recaps</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {left} of {ctx.monthlyRecaps} recaps left this month
          </p>
        </div>
        <Link href={`/app/${ctx.org.slug}/recaps/new`} className="btn-primary">
          New recap
        </Link>
      </div>

      {recaps && recaps.length > 0 ? (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-white">
          {recaps.map((recap) => {
            const open = recap.action_items.filter((i) => !i.done).length;
            return (
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
                  {recap.action_items.length > 0 && (
                    <p className="mt-2 text-xs text-ink-muted">
                      {open} open of {recap.action_items.length} action items
                    </p>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="rounded-2xl border border-dashed border-line bg-white p-10 text-center">
          <p className="font-medium">No recaps yet</p>
          <p className="mt-1 text-sm text-ink-muted">Paste your first meeting notes and Claude will do the rest.</p>
          <Link href={`/app/${ctx.org.slug}/recaps/new`} className="btn-primary mt-4 inline-flex">
            New recap
          </Link>
        </div>
      )}
    </div>
  );
}
