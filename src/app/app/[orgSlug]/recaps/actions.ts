"use server";

import { redirect } from "next/navigation";
import { getOrgContext } from "@/lib/orgs";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateRecap, RecapGenerationError } from "@/lib/ai/generate-recap";
import { recapInputSchema } from "@/lib/ai/recap-schema";

export type CreateRecapState =
  | { error: string; limitReached?: boolean; title: string; notes: string }
  | undefined;

/**
 * Create a recap with Claude.
 *
 * Order matters:
 *  1. who is asking (member of this workspace, via RLS) and what they sent;
 *  2. which modules the plan allows (decided in Postgres, not by the form);
 *  3. reserve one recap from the monthly limit (atomic, server-only RPC);
 *  4. call Claude; validate + repair the JSON;
 *  5. save. If 4 or 5 fails, the reserved recap is given back.
 * Recaps and action items are inserted with the secret key: users have no
 * insert rights on these tables, so nobody can skip the limit with the API.
 */
export async function createRecap(
  orgSlug: string,
  _prev: CreateRecapState,
  formData: FormData,
): Promise<CreateRecapState> {
  const ctx = await getOrgContext(orgSlug);
  if (!ctx) redirect("/app");

  const raw = { title: String(formData.get("title") ?? ""), notes: String(formData.get("notes") ?? "") };
  const input = recapInputSchema.safeParse(raw);
  if (!input.success) return { error: input.error.issues[0].message, ...raw };

  const supabase = await createClient();
  const { data: modules, error: modulesError } = await supabase.rpc("org_enabled_modules", { p_org: ctx.org.id });
  if (modulesError) return { error: "Couldn't check this workspace's plan. Please try again.", ...raw };
  if (!modules.includes("summary")) {
    return { error: "Recaps are not available for this workspace right now. Check Billing.", ...raw };
  }
  const withFollowupEmail = modules.includes("followup_email");

  const admin = createAdminClient();
  const { data: period, error: reserveError } = await admin.rpc("reserve_recap", { p_org: ctx.org.id });
  if (reserveError) return { error: "Couldn't check the monthly limit. Please try again.", ...raw };
  if (!period) {
    return {
      error: `This workspace has used all ${ctx.monthlyRecaps} recaps for this month.`,
      limitReached: true,
      ...raw,
    };
  }
  const release = () => admin.rpc("release_recap", { p_org: ctx.org.id, p_period: period });

  let recapId: string;
  try {
    const result = await generateRecap({
      title: input.data.title,
      notes: input.data.notes,
      withFollowupEmail,
      meetingDate: new Date().toISOString().slice(0, 10),
    });

    const { data: recap, error: recapError } = await admin
      .from("recaps")
      .insert({
        org_id: ctx.org.id,
        created_by: ctx.userId,
        title: input.data.title,
        input_notes: input.data.notes,
        output: result.output,
        model: result.model,
        input_tokens: result.inputTokens,
        output_tokens: result.outputTokens,
      })
      .select("id")
      .single();
    if (recapError) throw recapError;
    recapId = recap.id;

    if (result.output.action_items.length > 0) {
      const { error: itemsError } = await admin.from("action_items").insert(
        result.output.action_items.map((item) => ({
          recap_id: recap.id,
          org_id: ctx.org.id,
          text: item.text,
          owner_name: item.owner,
          due_date: item.due_date,
        })),
      );
      if (itemsError) {
        await admin.from("recaps").delete().eq("id", recap.id);
        throw itemsError;
      }
    }

    await admin.from("audit_log").insert({
      org_id: ctx.org.id,
      actor_id: ctx.userId,
      action: "recap.created",
      meta: {
        recap_id: recap.id,
        model: result.model,
        attempts: result.attempts,
        input_tokens: result.inputTokens,
        output_tokens: result.outputTokens,
      },
    });
  } catch (err) {
    await release();
    console.error("[recaps] create failed", err);
    const message =
      err instanceof RecapGenerationError ? err.message : "Couldn't save the recap. Please try again.";
    return { error: message, ...raw };
  }

  redirect(`/app/${ctx.org.slug}/recaps/${recapId}`);
}
