import { beforeEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { ActionItem, RecapDetail, RecapwellData, Workspace } from "./data";
import { createServer } from "./server";

// The tests talk to the server through a real MCP client over an in-memory transport,
// so they cover input validation, tool results and error texts end to end.
// Supabase is replaced by a small in-memory fake of RecapwellData.

const ACME: Workspace = { id: "org-acme", name: "Acme Studio", slug: "acme-studio", role: "owner", plan: "team" };
const RECAP_ID = "cccccccc-0000-4000-8000-000000000001";
const ITEM_ID = "aaaaaaaa-1111-4111-8111-000000000001";

function makeFake(): RecapwellData & { items: ActionItem[]; fail?: unknown } {
  const items: ActionItem[] = [
    { id: ITEM_ID, recapId: RECAP_ID, recapTitle: "Kickoff", text: "Draft the sitemap", owner: "Carol", dueDate: "2026-11-27", done: false },
    { id: "aaaaaaaa-1111-4111-8111-000000000002", recapId: RECAP_ID, recapTitle: "Kickoff", text: "Book the shoot", owner: "Alice", dueDate: null, done: false },
  ];
  const recap: RecapDetail = {
    id: RECAP_ID,
    title: "Kickoff",
    createdAt: "2026-11-19T10:00:00Z",
    workspace: { name: ACME.name, slug: ACME.slug },
    summary: "Launch at the end of Q1.",
    decisions: ["Launch at the end of Q1"],
    openQuestions: [],
    followUpEmail: { subject: "Kickoff recap", body: "Hi team, ..." },
    actionItems: items,
  };
  const fake = {
    items,
    fail: undefined as unknown,
    async whoAmI() {
      return "alice@recapwell.test";
    },
    async listWorkspaces() {
      if (fake.fail) throw fake.fail;
      return [ACME];
    },
    async listRecaps() {
      return [{ id: recap.id, title: recap.title, createdAt: recap.createdAt, summary: recap.summary }];
    },
    async getRecap(id: string) {
      return id === RECAP_ID ? recap : null;
    },
    async listOpenActionItems(_orgId: string, owner?: string) {
      return items.filter((i) => !i.done && (!owner || i.owner?.toLowerCase().includes(owner.toLowerCase())));
    },
    async setActionItemDone(id: string, done: boolean) {
      const item = items.find((i) => i.id === id);
      if (!item) return null;
      item.done = done;
      return item;
    },
  };
  return fake;
}

let fake: ReturnType<typeof makeFake>;
let client: Client;

async function call(name: string, args: Record<string, unknown> = {}) {
  const result = await client.callTool({ name, arguments: args });
  const text = (result.content as { type: string; text: string }[]).map((c) => c.text).join("\n");
  return { isError: Boolean(result.isError), text };
}

beforeEach(async () => {
  fake = makeFake();
  const server = createServer(fake);
  const [serverSide, clientSide] = InMemoryTransport.createLinkedPair();
  await server.connect(serverSide);
  client = new Client({ name: "test", version: "1.0.0" });
  await client.connect(clientSide);
});

describe("recapwell MCP server", () => {
  it("exposes five tools, and only mark_action_item_done can write", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      "get_recap",
      "list_open_action_items",
      "list_recaps",
      "list_workspaces",
      "mark_action_item_done",
    ]);
    const writers = tools.filter((t) => !t.annotations?.readOnlyHint).map((t) => t.name);
    expect(writers).toEqual(["mark_action_item_done"]);
  });

  it("list_workspaces shows the user and the slugs Claude needs next", async () => {
    const { isError, text } = await call("list_workspaces");
    expect(isError).toBe(false);
    expect(text).toContain("alice@recapwell.test");
    expect(text).toContain("slug: acme-studio");
  });

  it("get_recap returns summary, action item ids and the follow-up email", async () => {
    const { text } = await call("get_recap", { recap_id: RECAP_ID });
    expect(text).toContain("Launch at the end of Q1.");
    expect(text).toContain(`action_item_id: ${ITEM_ID}`);
    expect(text).toContain("Subject: Kickoff recap");
  });

  it("list_open_action_items filters by owner", async () => {
    const { text } = await call("list_open_action_items", { org_slug: "acme-studio", owner: "carol" });
    expect(text).toContain("Draft the sitemap");
    expect(text).not.toContain("Book the shoot");
  });

  it("mark_action_item_done updates the item and it leaves the open list", async () => {
    const { isError, text } = await call("mark_action_item_done", { action_item_id: ITEM_ID });
    expect(isError).toBe(false);
    expect(text).toContain("Marked as done");
    expect(fake.items[0].done).toBe(true);

    const open = await call("list_open_action_items", { org_slug: "acme-studio" });
    expect(open.text).not.toContain("Draft the sitemap");
  });

  it("rejects invalid input before touching the data layer", async () => {
    const badUuid = await call("get_recap", { recap_id: "not-a-uuid" });
    expect(badUuid.isError).toBe(true);
    expect(badUuid.text).toMatch(/Invalid UUID/i);

    const badArgs = await call("list_recaps", { org_slug: "Not A Slug!", limit: 500 });
    expect(badArgs.isError).toBe(true);
    expect(badArgs.text).toMatch(/workspace slug/);
    expect(badArgs.text).toMatch(/<=50/);
  });

  it("explains unknown workspaces and hidden records instead of failing", async () => {
    const otherOrg = await call("list_recaps", { org_slug: "bluebird-labs" });
    expect(otherOrg.isError).toBe(true);
    expect(otherOrg.text).toContain(`No workspace "bluebird-labs"`);

    const hidden = await call("mark_action_item_done", { action_item_id: "bbbbbbbb-1111-4111-8111-000000000009" });
    expect(hidden.isError).toBe(true);
    expect(hidden.text).toContain("not found, or you can't change it");
  });

  it("turns Supabase errors into readable text", async () => {
    fake.fail = { code: "42501", message: "permission denied for table memberships" };
    const denied = await call("list_workspaces");
    expect(denied).toEqual({ isError: true, text: "You don't have permission to do that in this workspace." });

    fake.fail = Object.assign(new Error("Invalid login credentials"), { name: "AuthApiError" });
    const auth = await call("list_workspaces");
    expect(auth.text).toContain("wrong RECAPWELL_EMAIL or RECAPWELL_PASSWORD");

    fake.fail = new TypeError("fetch failed");
    const offline = await call("list_workspaces");
    expect(offline.text).toContain("Can't reach Supabase");
  });
});
