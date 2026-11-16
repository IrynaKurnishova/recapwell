import { Suspense } from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { getCurrentUser } from "@/lib/supabase/server";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
        <Logo />
        <Suspense fallback={<Link href="/login" className="btn-secondary">Sign in</Link>}>
          <HeaderAuthLink />
        </Suspense>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-6 px-6 py-24 text-center">
        <span className="rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand">
          Demo project
        </span>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Meeting notes in. <span className="text-brand">Clear recap</span> out.
        </h1>
        <p className="max-w-xl text-lg text-ink-muted">
          Paste your notes and Recapwell writes the summary, action items with owners, and a ready-to-send
          follow-up email.
        </p>
        <Suspense fallback={<Link href="/login" className="btn-primary px-6 py-3 text-base">Start free</Link>}>
          <HeroCta />
        </Suspense>
      </main>

      <footer className="py-6 text-center text-xs text-ink-muted">
        Recapwell is a fictional product built as a portfolio demo.
      </footer>
    </div>
  );
}

// Session-dependent bits stream in; the rest of the page is a static shell.
async function HeaderAuthLink() {
  const user = await getCurrentUser();
  return (
    <Link href={user ? "/app" : "/login"} className="btn-secondary">
      {user ? "Open app" : "Sign in"}
    </Link>
  );
}

async function HeroCta() {
  const user = await getCurrentUser();
  return (
    <Link href={user ? "/app" : "/login"} className="btn-primary px-6 py-3 text-base">
      {user ? "Go to dashboard" : "Start free"}
    </Link>
  );
}
