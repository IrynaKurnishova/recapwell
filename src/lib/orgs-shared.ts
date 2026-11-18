import type { Enums } from "@/lib/database.types";

/** Constants and helpers safe to import from the proxy, Server and Client Components. */
export const LAST_ORG_COOKIE = "rw_last_org";

export type OrgRole = Enums<"org_role">;
export type PlanTier = Enums<"plan_tier">;

export const ROLE_LABELS: Record<OrgRole, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
};

export const PLAN_LABELS: Record<PlanTier, string> = {
  free: "Free",
  team: "Team",
};

export function canManageMembers(role: OrgRole) {
  return role === "owner" || role === "admin";
}

/** "Acme Studio!" → "acme-studio" (matches the DB check on organizations.slug). */
export function slugify(input: string) {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
}

export const SLUG_PATTERN = "^[a-z0-9]([a-z0-9-]{0,46}[a-z0-9])?$";
