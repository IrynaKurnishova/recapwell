// What the MCP tools need from Recapwell, independent of Supabase.
// The server depends on this interface, so tests can use an in-memory fake.

export type Role = "owner" | "admin" | "member";
export type Plan = "free" | "team";

export type Workspace = { id: string; name: string; slug: string; role: Role; plan: Plan };

export type RecapSummary = { id: string; title: string; createdAt: string; summary: string | null };

export type ActionItem = {
  id: string;
  recapId: string;
  recapTitle: string | null;
  text: string;
  owner: string | null;
  dueDate: string | null;
  done: boolean;
};

export type FollowUpEmail = { subject: string | null; body: string };

export type RecapDetail = {
  id: string;
  title: string;
  createdAt: string;
  workspace: { name: string; slug: string } | null;
  summary: string | null;
  decisions: string[];
  openQuestions: string[];
  followUpEmail: FollowUpEmail | null;
  actionItems: ActionItem[];
};

export interface RecapwellData {
  /** Email of the signed-in Recapwell user. */
  whoAmI(): Promise<string>;
  /** Workspaces the user is a member of (RLS hides all others). */
  listWorkspaces(): Promise<Workspace[]>;
  listRecaps(orgId: string, limit: number): Promise<RecapSummary[]>;
  /** null when the recap doesn't exist or the user can't see it. */
  getRecap(recapId: string): Promise<RecapDetail | null>;
  listOpenActionItems(orgId: string, owner?: string): Promise<ActionItem[]>;
  /** null when the item doesn't exist or the user can't change it. */
  setActionItemDone(actionItemId: string, done: boolean): Promise<ActionItem | null>;
}
