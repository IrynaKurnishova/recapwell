"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function OrgNav({ slug }: { slug: string }) {
  const pathname = usePathname();
  const items = [
    { href: `/app/${slug}`, label: "Overview" },
    { href: `/app/${slug}/members`, label: "Members" },
  ];

  return (
    <nav className="flex gap-1 text-sm">
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-lg px-3 py-1.5 font-medium transition ${
              active ? "bg-surface text-ink" : "text-ink-muted hover:text-ink"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
