import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <p className="text-sm font-semibold text-brand">404</p>
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="text-ink-muted">This page doesn&apos;t exist, or you don&apos;t have access to it.</p>
      <Link href="/app" className="btn-primary">
        Go to my workspaces
      </Link>
    </main>
  );
}
