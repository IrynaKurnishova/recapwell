import { Suspense } from "react";
import type { Metadata } from "next";
import { Logo } from "@/components/Logo";
import { safeNextPath } from "@/lib/safe-redirect";
import { AuthForm } from "./AuthForm";

export const metadata: Metadata = { title: "Sign in · Recapwell" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="flex flex-1 items-center justify-center bg-surface px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Logo />
          <h1 className="text-2xl font-semibold">Welcome back</h1>
          <p className="text-sm text-ink-muted">Turn messy meeting notes into a clear recap in seconds.</p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-6 shadow-sm">
          <Suspense fallback={<AuthForm next="/app" />}>
            <AuthFormWithNext searchParams={searchParams} />
          </Suspense>
        </div>
      </div>
    </main>
  );
}

async function AuthFormWithNext({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const { next } = await searchParams;
  return <AuthForm next={safeNextPath(typeof next === "string" ? next : undefined)} />;
}
