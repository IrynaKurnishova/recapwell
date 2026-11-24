import "server-only";
import { createClient } from "@/lib/supabase/server";

/** First day of the current month (UTC), as stored in usage_counters.period_start. */
export function currentPeriodStart() {
  return new Date().toISOString().slice(0, 8) + "01";
}

/** Recaps used this month by a workspace (members can read their org's counter via RLS). */
export async function recapsUsedThisMonth(orgId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("usage_counters")
    .select("recaps_count")
    .eq("org_id", orgId)
    .eq("period_start", currentPeriodStart())
    .maybeSingle();
  return data?.recaps_count ?? 0;
}
