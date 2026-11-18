import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { Logo } from "@/components/Logo";
import { signOut } from "@/app/auth/actions";
import { ROLE_LABELS } from "@/lib/orgs-shared";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { AcceptButton } from "./AcceptButton";

export const metadata: Metadata = { title: "Join a workspace · Recapwell", robots: { index: false } };

export default function InvitePage({ params }: PageProps<"/invite/[token]">) {
  return (
    <main className="flex flex-1 items-center justify-center bg-surface px-6 py-16">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="rounded-2xl border border-line bg-white p-6 text-center shadow-sm">
          <Suspense fallback={<p className="text-sm text-ink-muted">Checking your invite…</p>}>
            <Invite params={params} />
          </Suspense>
        </div>
      </div>
    </main>
  );
}

async function Invite({ params }: Pick<PageProps<"/invite/[token]">, "params">) {
  const { token } = await params;
  const invitePath = `/invite/${token}`;

  // get_invitation works for guests too: the token is the secret.
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_invitation", { p_token: token });
  const invite = data?.[0];

  if (!invite) {
    return <Message title="Invite not found" text="The link may be incomplete, or the invite was revoked." />;
  }
  if (invite.accepted) {
    return (
      <Message title="This invite was already used" text="If it was you, your workspace is waiting.">
        <Link href="/app" className="btn-primary">
          Open Recapwell
        </Link>
      </Message>
    );
  }
  if (invite.expired) {
    return <Message title="This invite has expired" text={`Ask someone at ${invite.org_name} to send a new one.`} />;
  }

  const heading = (
    <>
      <h1 className="text-xl font-semibold">Join {invite.org_name}</h1>
      <p className="mt-2 text-sm text-ink-muted">
        You&apos;ve been invited as <strong className="text-ink">{ROLE_LABELS[invite.role]}</strong>. This invite is for{" "}
        <strong className="text-ink">{invite.email}</strong>.
      </p>
    </>
  );

  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="flex flex-col gap-5">
        <div>{heading}</div>
        <Link href={`/login?next=${encodeURIComponent(invitePath)}`} className="btn-primary w-full">
          Sign in or create an account
        </Link>
        <p className="text-xs text-ink-muted">Use {invite.email} so we can match your invite.</p>
      </div>
    );
  }

  const signedInEmail = String(user.email ?? "").toLowerCase();
  if (signedInEmail !== invite.email) {
    return (
      <div className="flex flex-col gap-5">
        <div>{heading}</div>
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          You&apos;re signed in as {signedInEmail}. Sign in with {invite.email} to accept.
        </p>
        <form action={signOut}>
          <input type="hidden" name="next" value={invitePath} />
          <button type="submit" className="btn-secondary w-full">
            Switch account
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div>{heading}</div>
      <AcceptButton token={token} orgName={invite.org_name} />
    </div>
  );
}

function Message({ title, text, children }: { title: string; text: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="text-sm text-ink-muted">{text}</p>
      {children}
    </div>
  );
}
