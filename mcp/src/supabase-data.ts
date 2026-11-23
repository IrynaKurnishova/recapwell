import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../src/lib/database.types";
import type { ActionItem, FollowUpEmail, RecapDetail, RecapwellData, Workspace } from "./data";
import { UserFacingError } from "./errors";
import { z } from "zod";

type Client = SupabaseClient<Database>;

/** Recaps store Claude's output as JSON; read it defensively. */
const recapOutput = z
  .object({
    summary: z.string().optional(),
    decisions: z.array(z.string()).optional(),
    open_questions: z.array(z.string()).optional(),
    followup_email: z
      .union([z.string(), z.object({ subject: z.string().optional(), body: z.string() })])
      .optional(),
  })
  .loose();

function parseOutput(output: unknown) {
  const parsed = recapOutput.safeParse(output ?? {});
  const o = parsed.success ? parsed.data : {};
  let followUpEmail: FollowUpEmail | null = null;
  if (typeof o.followup_email === "string") followUpEmail = { subject: null, body: o.followup_email };
  else if (o.followup_email) followUpEmail = { subject: o.followup_email.subject ?? null, body: o.followup_email.body };
  return {
    summary: o.summary ?? null,
    decisions: o.decisions ?? [],
    openQuestions: o.open_questions ?? [],
    followUpEmail,
  };
}

type ItemRow = {
  id: string;
  recap_id: string;
  text: string;
  owner_name: string | null;
  due_date: string | null;
  done: boolean;
  recaps?: { title: string } | null;
};

const toItem = (row: ItemRow): ActionItem => ({
  id: row.id,
  recapId: row.recap_id,
  recapTitle: row.recaps?.title ?? null,
  text: row.text,
  owner: row.owner_name,
  dueDate: row.due_date,
  done: row.done,
});

const ITEM_COLUMNS = "id, recap_id, text, owner_name, due_date, done, recaps (title)";

/** Escapes LIKE wildcards so "50%" matches literally. */
const likeEscape = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export type Credentials = { email: string; password: string };

/**
 * Talks to Supabase as a normal signed-in user (publishable key + email/password),
 * so every query goes through the same Row Level Security as the web app.
 */
export class SupabaseRecapwellData implements RecapwellData {
  private session: Promise<{ userId: string; email: string }> | null = null;

  constructor(
    private readonly client: Client,
    /** Email/password sign-in, or an already-known user (tests with a pre-authenticated client). */
    private readonly auth: Credentials | { userId: string; email: string },
  ) {}

  /** Signs in once, lazily, so the server starts even if Supabase is down. */
  private me() {
    if (!this.session) {
      const auth = this.auth;
      this.session =
        "userId" in auth
          ? Promise.resolve(auth)
          : this.client.auth.signInWithPassword(auth).then(({ data, error }) => {
              if (error) throw error;
              return { userId: data.user.id, email: data.user.email ?? auth.email };
            });
      // Allow a retry on the next call if sign-in failed.
      this.session.catch(() => (this.session = null));
    }
    return this.session;
  }

  async whoAmI() {
    return (await this.me()).email;
  }

  async listWorkspaces(): Promise<Workspace[]> {
    const { userId } = await this.me();
    // RLS shows memberships of everyone in my workspaces, so filter to my own rows.
    const { data, error } = await this.client
      .from("memberships")
      .select("role, organizations (id, name, slug, subscriptions (plan))")
      .eq("user_id", userId)
      .order("created_at");
    if (error) throw error;

    return data.flatMap(({ role, organizations: org }) => {
      if (!org) return [];
      const sub = Array.isArray(org.subscriptions) ? org.subscriptions[0] : org.subscriptions;
      return [{ id: org.id, name: org.name, slug: org.slug, role, plan: sub?.plan ?? "free" }];
    });
  }

  async listRecaps(orgId: string, limit: number) {
    await this.me();
    const { data, error } = await this.client
      .from("recaps")
      .select("id, title, created_at, output")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data.map((r) => ({ id: r.id, title: r.title, createdAt: r.created_at, summary: parseOutput(r.output).summary }));
  }

  async getRecap(recapId: string): Promise<RecapDetail | null> {
    await this.me();
    const { data, error } = await this.client
      .from("recaps")
      .select("id, title, created_at, output, organizations (name, slug)")
      .eq("id", recapId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;

    const { data: items, error: itemsError } = await this.client
      .from("action_items")
      .select(ITEM_COLUMNS)
      .eq("recap_id", recapId)
      .order("created_at");
    if (itemsError) throw itemsError;

    return {
      id: data.id,
      title: data.title,
      createdAt: data.created_at,
      workspace: data.organizations ? { name: data.organizations.name, slug: data.organizations.slug } : null,
      ...parseOutput(data.output),
      actionItems: (items as ItemRow[]).map(toItem),
    };
  }

  async listOpenActionItems(orgId: string, owner?: string) {
    await this.me();
    let query = this.client
      .from("action_items")
      .select(ITEM_COLUMNS)
      .eq("org_id", orgId)
      .eq("done", false)
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(100);
    if (owner) query = query.ilike("owner_name", `%${likeEscape(owner)}%`);
    const { data, error } = await query;
    if (error) throw error;
    return (data as ItemRow[]).map(toItem);
  }

  async setActionItemDone(actionItemId: string, done: boolean) {
    await this.me();
    // RLS + a column grant allow members to change only `done`, `owner_name` and `due_date`.
    const { data, error } = await this.client
      .from("action_items")
      .update({ done })
      .eq("id", actionItemId)
      .select(ITEM_COLUMNS)
      .maybeSingle();
    if (error) throw error;
    return data ? toItem(data as ItemRow) : null;
  }
}

export function missingEnv(name: string): never {
  throw new UserFacingError(`Missing ${name}. Set it in the MCP server config or in mcp/.env (see mcp/.env.example).`);
}
