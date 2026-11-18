import Link from "next/link";
import type { MyOrg } from "@/lib/orgs";
import { ROLE_LABELS } from "@/lib/orgs-shared";

/** Workspace dropdown. Uses <details> so it works without client JS. */
export function OrgSwitcher({ current, orgs }: { current: MyOrg; orgs: MyOrg[] }) {
  return (
    <details className="group relative">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium hover:bg-surface [&::-webkit-details-marker]:hidden">
        <span className="grid size-6 place-items-center rounded-md bg-ink text-xs font-semibold text-white">
          {current.name.charAt(0).toUpperCase()}
        </span>
        <span className="max-w-40 truncate">{current.name}</span>
        <svg aria-hidden viewBox="0 0 20 20" className="size-4 text-ink-muted transition group-open:rotate-180">
          <path fill="currentColor" d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4Z" />
        </svg>
      </summary>

      <div className="absolute left-0 z-20 mt-2 w-64 rounded-xl border border-line bg-white p-1.5 shadow-lg">
        <p className="px-2.5 pb-1 pt-1.5 text-xs font-medium uppercase tracking-wide text-ink-muted">Workspaces</p>
        <ul>
          {orgs.map((org) => (
            <li key={org.id}>
              <Link
                href={`/app/${org.slug}`}
                className="flex items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-sm hover:bg-surface"
                aria-current={org.id === current.id ? "page" : undefined}
              >
                <span className="truncate">{org.name}</span>
                <span className="shrink-0 text-xs text-ink-muted">
                  {org.id === current.id ? "✓ " : ""}
                  {ROLE_LABELS[org.role]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-1 border-t border-line pt-1">
          <Link href="/app/onboarding" className="block rounded-lg px-2.5 py-2 text-sm text-brand hover:bg-surface">
            + New workspace
          </Link>
        </div>
      </div>
    </details>
  );
}
