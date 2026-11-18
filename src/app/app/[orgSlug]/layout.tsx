import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Logo } from "@/components/Logo";
import { OrgNav } from "@/components/OrgNav";
import { OrgSwitcher } from "@/components/OrgSwitcher";
import { UserMenu } from "@/components/UserMenu";
import { getOrgContext } from "@/lib/orgs";

export default function OrgLayout({ children, params }: LayoutProps<"/app/[orgSlug]">) {
  return (
    <div className="flex flex-1 flex-col bg-surface">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-6 py-3">
          <Logo />
          <span aria-hidden className="text-line">/</span>
          <Suspense fallback={<HeaderSkeleton />}>
            <OrgHeader params={params} />
          </Suspense>
        </div>
      </header>
      <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">{children}</div>
    </div>
  );
}

async function OrgHeader({ params }: Pick<LayoutProps<"/app/[orgSlug]">, "params">) {
  const { orgSlug } = await params;
  const ctx = await getOrgContext(orgSlug);
  // Not a member (or no such workspace): same 404 either way, so slugs don't leak.
  if (!ctx) notFound();

  return (
    <>
      <OrgSwitcher current={ctx.org} orgs={ctx.orgs} />
      <OrgNav slug={ctx.org.slug} />
      <div className="ml-auto">
        <UserMenu email={ctx.email} />
      </div>
    </>
  );
}

function HeaderSkeleton() {
  return (
    <>
      <div className="h-8 w-36 animate-pulse rounded-lg bg-surface" />
      <div className="ml-auto h-9 w-24 animate-pulse rounded-lg bg-surface" />
    </>
  );
}
