import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getMyOrgs } from "@/lib/orgs";
import { getCurrentUser } from "@/lib/supabase/server";
import { LAST_ORG_COOKIE } from "@/lib/orgs-shared";

// /app has no UI of its own: it sends the user to their last workspace,
// their first workspace, or onboarding.
export default function AppIndexPage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-surface">
      <Suspense fallback={<p className="text-sm text-ink-muted">Opening your workspace…</p>}>
        <RedirectToWorkspace />
      </Suspense>
    </main>
  );
}

async function RedirectToWorkspace(): Promise<null> {
  if (!(await getCurrentUser())) redirect("/login?next=/app");

  const orgs = await getMyOrgs();
  if (orgs.length === 0) redirect("/app/onboarding");

  const last = (await cookies()).get(LAST_ORG_COOKIE)?.value;
  const target = orgs.find((o) => o.slug === last) ?? orgs[0];
  redirect(`/app/${target.slug}`);
}
