import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { RecapwellData, Workspace } from "./data";
import { toUserMessage, UserFacingError } from "./errors";
import { formatItem, formatOpenItems, formatRecap, formatRecapList, formatWorkspaces } from "./format";

export const SERVER_NAME = "recapwell";
export const SERVER_VERSION = "0.1.0";

// Same rule as organizations.slug in the database.
const orgSlug = z
  .string()
  .regex(/^[a-z0-9]([a-z0-9-]{0,46}[a-z0-9])?$/, "Use the workspace slug from list_workspaces, e.g. acme-studio")
  .describe("Workspace slug from list_workspaces, e.g. acme-studio");

const ok = (text: string): CallToolResult => ({ content: [{ type: "text", text }] });
const fail = (text: string): CallToolResult => ({ isError: true, content: [{ type: "text", text }] });

/** Runs a tool body and turns any error into a readable tool error (instead of a protocol error). */
async function run(body: () => Promise<string>): Promise<CallToolResult> {
  try {
    return ok(await body());
  } catch (err) {
    if (!(err instanceof UserFacingError)) console.error("[recapwell-mcp]", err);
    return fail(toUserMessage(err));
  }
}

export function createServer(data: RecapwellData) {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    {
      instructions:
        "Recapwell turns meeting notes into recaps with action items. " +
        "Start with list_workspaces to get workspace slugs, then list_recaps / list_open_action_items. " +
        "You act as one Recapwell user and only see that user's workspaces.",
    },
  );

  async function workspaceBySlug(slug: string): Promise<Workspace> {
    const ws = (await data.listWorkspaces()).find((w) => w.slug === slug);
    if (!ws) {
      throw new UserFacingError(
        `No workspace "${slug}" — it doesn't exist or you're not a member. Call list_workspaces to see yours.`,
      );
    }
    return ws;
  }

  server.registerTool(
    "list_workspaces",
    {
      title: "List workspaces",
      description: "Lists the Recapwell workspaces the signed-in user belongs to, with slug, role and plan.",
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    () => run(async () => formatWorkspaces(await data.whoAmI(), await data.listWorkspaces())),
  );

  server.registerTool(
    "list_recaps",
    {
      title: "List recaps",
      description: "Lists the latest meeting recaps in a workspace, newest first, with their ids and short summaries.",
      inputSchema: {
        org_slug: orgSlug,
        limit: z.number().int().min(1).max(50).default(10).describe("How many recaps to return (1–50, default 10)"),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    ({ org_slug, limit }) =>
      run(async () => {
        const ws = await workspaceBySlug(org_slug);
        return formatRecapList(ws, await data.listRecaps(ws.id, limit));
      }),
  );

  server.registerTool(
    "get_recap",
    {
      title: "Get recap",
      description:
        "Returns one recap in full: summary, decisions, open questions, action items (with ids) and the follow-up email.",
      inputSchema: { recap_id: z.uuid().describe("recap_id from list_recaps") },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    ({ recap_id }) =>
      run(async () => {
        const recap = await data.getRecap(recap_id);
        if (!recap) throw new UserFacingError("Recap not found, or it's in a workspace you're not a member of.");
        return formatRecap(recap);
      }),
  );

  server.registerTool(
    "list_open_action_items",
    {
      title: "List open action items",
      description:
        "Lists action items that aren't done yet in a workspace, soonest due date first. Optionally filter by owner name.",
      inputSchema: {
        org_slug: orgSlug,
        owner: z
          .string()
          .trim()
          .min(1)
          .max(120)
          .optional()
          .describe('Only items whose owner name contains this text, e.g. "Carol"'),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    ({ org_slug, owner }) =>
      run(async () => {
        const ws = await workspaceBySlug(org_slug);
        return formatOpenItems(ws, await data.listOpenActionItems(ws.id, owner), owner);
      }),
  );

  server.registerTool(
    "mark_action_item_done",
    {
      title: "Mark action item done",
      description: "Marks one action item as done (or re-opens it with done=false).",
      inputSchema: {
        action_item_id: z.uuid().describe("action_item_id from get_recap or list_open_action_items"),
        done: z.boolean().default(true).describe("true = done (default), false = re-open"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    ({ action_item_id, done }) =>
      run(async () => {
        const item = await data.setActionItemDone(action_item_id, done);
        if (!item) throw new UserFacingError("Action item not found, or you can't change it.");
        return `${done ? "Marked as done" : "Re-opened"}:\n${formatItem(item)}`;
      }),
  );

  return server;
}
