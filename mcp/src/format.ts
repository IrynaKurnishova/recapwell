import type { ActionItem, RecapDetail, RecapSummary, Workspace } from "./data";

// Plain-text answers for the model. Every line carries the ids/slugs
// Claude needs for the next tool call.

const date = (iso: string) => iso.slice(0, 10);

export function formatWorkspaces(email: string, list: Workspace[]) {
  if (list.length === 0) return `Signed in as ${email}. You aren't a member of any workspace yet.`;
  const lines = list.map((w) => `- ${w.name} — slug: ${w.slug}, your role: ${w.role}, plan: ${w.plan}`);
  return [`Signed in as ${email}. Workspaces (${list.length}):`, ...lines].join("\n");
}

export function formatRecapList(ws: Workspace, recaps: RecapSummary[]) {
  if (recaps.length === 0) return `No recaps in ${ws.name} yet.`;
  const lines = recaps.map(
    (r) => `- [${date(r.createdAt)}] ${r.title} (recap_id: ${r.id})${r.summary ? `\n  ${r.summary}` : ""}`,
  );
  return [`Latest ${recaps.length} recap(s) in ${ws.name}:`, ...lines].join("\n");
}

export function formatItem(i: ActionItem) {
  const meta = [i.owner ? `owner: ${i.owner}` : "no owner", i.dueDate ? `due ${i.dueDate}` : null]
    .filter(Boolean)
    .join(", ");
  return `- [${i.done ? "x" : " "}] ${i.text} (${meta}) — action_item_id: ${i.id}`;
}

export function formatRecap(r: RecapDetail) {
  const parts = [
    `# ${r.title}`,
    `Date: ${date(r.createdAt)}${r.workspace ? ` · Workspace: ${r.workspace.name} (${r.workspace.slug})` : ""}`,
    "",
    "## Summary",
    r.summary ?? "(no summary)",
  ];
  if (r.decisions.length) parts.push("", "## Decisions", ...r.decisions.map((d) => `- ${d}`));
  if (r.openQuestions.length) parts.push("", "## Open questions", ...r.openQuestions.map((q) => `- ${q}`));
  parts.push("", "## Action items", ...(r.actionItems.length ? r.actionItems.map(formatItem) : ["(none)"]));
  parts.push("", "## Follow-up email");
  if (r.followUpEmail) {
    if (r.followUpEmail.subject) parts.push(`Subject: ${r.followUpEmail.subject}`, "");
    parts.push(r.followUpEmail.body);
  } else {
    parts.push("(not generated for this recap — the Follow-up email module creates it on the Team plan)");
  }
  return parts.join("\n");
}

export function formatOpenItems(ws: Workspace, items: ActionItem[], owner?: string) {
  const who = owner ? ` for "${owner}"` : "";
  if (items.length === 0) return `No open action items${who} in ${ws.name}.`;
  const lines = items.map((i) => `${formatItem(i)}${i.recapTitle ? `\n  from recap: ${i.recapTitle}` : ""}`);
  return [`Open action items${who} in ${ws.name} (${items.length}):`, ...lines].join("\n");
}
