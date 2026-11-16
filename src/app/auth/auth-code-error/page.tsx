import Link from "next/link";

export default function AuthCodeErrorPage() {
  return (
    <main className="mx-auto flex max-w-md flex-1 flex-col justify-center gap-4 px-6 py-24 text-center">
      <h1 className="text-2xl font-semibold">That sign-in link didn&apos;t work</h1>
      <p className="text-ink-muted">It may have expired or already been used. Please try signing in again.</p>
      <Link href="/login" className="btn-primary mx-auto">
        Back to sign in
      </Link>
    </main>
  );
}
