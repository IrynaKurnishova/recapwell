import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/Logo";
import { getMyOrgs } from "@/lib/orgs";
import { CreateOrgForm } from "./CreateOrgForm";

export const metadata: Metadata = { title: "Create a workspace · Recapwell" };

export default function OnboardingPage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-surface px-6 py-16">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Logo />
          <h1 className="text-2xl font-semibold">Create a workspace</h1>
          <p className="text-sm text-ink-muted">
            A workspace holds your team&apos;s recaps, members and billing. You can invite people next.
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-6 shadow-sm">
          <CreateOrgForm />
        </div>
        <Suspense>
          <BackToWorkspaces />
        </Suspense>
      </div>
    </main>
  );
}

async function BackToWorkspaces() {
  const orgs = await getMyOrgs();
  if (orgs.length === 0) {
    return (
      <p className="mt-6 text-center text-sm text-ink-muted">
        Got an invite? Open the link from it to join your team&apos;s workspace.
      </p>
    );
  }
  return (
    <p className="mt-6 text-center text-sm">
      <Link href="/app" className="text-brand hover:underline">
        ← Back to my workspaces
      </Link>
    </p>
  );
}
