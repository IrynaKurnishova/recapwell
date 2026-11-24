import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { UsageBar } from "@/components/UsageBar";
import { getOrgContext } from "@/lib/orgs";
import { canManageMembers } from "@/lib/orgs-shared";
import { createClient } from "@/lib/supabase/server";
import { recapsUsedThisMonth } from "@/lib/usage";
import { NewRecapForm } from "./NewRecapForm";

export const metadata: Metadata = { title: "New recap · Recapwell" };

type Props = PageProps<"/app/[orgSlug]/recaps/new">;

export default function NewRecapPage({ params }: Props) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Suspense>
          <BackLink params={params} />
        </Suspense>
        <h1 className="mt-2 text-2xl font-semibold">New recap</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Paste your meeting notes. Claude writes a summary, decisions, open questions and action items.
        </p>
      </div>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white" />}>
        <Form params={params} />
      </Suspense>
    </div>
  );
}

async function BackLink({ params }: Pick<Props, "params">) {
  const { orgSlug } = await params;
  return (
    <Link href={`/app/${orgSlug}/recaps`} className="text-sm text-ink-muted hover:text-ink">
      ← All recaps
    </Link>
  );
}

async function Form({ params }: Pick<Props, "params">) {
  const { orgSlug } = await params;
  const ctx = await getOrgContext(orgSlug);
  if (!ctx) notFound();

  const supabase = await createClient();
  const [used, { data: modules }] = await Promise.all([
    recapsUsedThisMonth(ctx.org.id),
    supabase.rpc("org_enabled_modules", { p_org: ctx.org.id }),
  ]);
  const withEmail = modules?.includes("followup_email") ?? false;
  const canManage = canManageMembers(ctx.org.role);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_16rem]">
      <div className="rounded-2xl border border-line bg-white p-6">
        <NewRecapForm slug={ctx.org.slug} canManageBilling={canManage} />
      </div>
      <aside className="flex flex-col gap-4">
        <div className="rounded-2xl border border-line bg-white p-5">
          <UsageBar label="Recaps this month" used={used} limit={ctx.monthlyRecaps} />
        </div>
        <div className="rounded-2xl border border-line bg-white p-5 text-sm">
          <p className="font-medium">Included in this recap</p>
          <ul className="mt-2 flex flex-col gap-1 text-ink-muted">
            <li>✓ Summary and action items</li>
            <li>{withEmail ? "✓ Follow-up email" : "— Follow-up email (Team plan)"}</li>
          </ul>
          {!withEmail && ctx.plan === "free" && canManage && (
            <Link href={`/app/${ctx.org.slug}/billing`} className="mt-3 inline-block font-medium text-brand">
              Upgrade to Team
            </Link>
          )}
        </div>
      </aside>
    </div>
  );
}
