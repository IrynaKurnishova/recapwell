import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { getCurrentUser } from "@/lib/supabase/server";
import { signOut } from "@/app/auth/actions";

export const metadata: Metadata = { title: "Dashboard · Recapwell" };

export default function DashboardPage() {
  return (
    <div className="flex flex-1 flex-col bg-surface">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Logo />
          <Suspense fallback={<div className="h-9 w-24 animate-pulse rounded-lg bg-surface" />}>
            <UserMenu />
          </Suspense>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <h1 className="text-2xl font-semibold">Your recaps</h1>
        <Suspense fallback={<p className="mt-1 h-6 w-40 animate-pulse rounded bg-line" />}>
          <PlanLine />
        </Suspense>

        <div className="mt-8 rounded-2xl border border-dashed border-line bg-white p-10 text-center">
          <p className="font-medium">No recaps yet</p>
          <p className="mt-1 text-sm text-ink-muted">
            Paste meeting notes and get a summary, action items and a follow-up email. (Coming in step 5.)
          </p>
        </div>
      </main>
    </div>
  );
}

// The proxy already redirects guests, but always verify on the server too.
async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/app");
  return user;
}

async function UserMenu() {
  const user = await requireUser();
  return (
    <div className="flex items-center gap-4 text-sm">
      <span className="hidden text-ink-muted sm:inline">{user.email}</span>
      <form action={signOut}>
        <button type="submit" className="btn-secondary">Sign out</button>
      </form>
    </div>
  );
}

async function PlanLine() {
  await requireUser();
  // Real plan comes from the subscriptions table in step 3.
  return <p className="mt-1 text-ink-muted">You&apos;re on the Free plan.</p>;
}
