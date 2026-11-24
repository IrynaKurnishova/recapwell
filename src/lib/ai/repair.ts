import type * as z from "zod/v4";

/**
 * Validate-and-repair loop for JSON answers from a model.
 * Kept free of SDK and Next.js imports so it can be unit-tested with a fake model.
 */

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type ModelTurn = {
  text: string;
  /** "end_turn", "max_tokens", "refusal", ... */
  stopReason: string | null;
  inputTokens: number;
  outputTokens: number;
};

export type CallModel = (messages: ChatMessage[]) => Promise<ModelTurn>;

export type RepairResult<T> = {
  data: T;
  /** 1 = valid on the first try, 2 = needed one repair round, ... */
  attempts: number;
  inputTokens: number;
  outputTokens: number;
};

export class ModelOutputError extends Error {
  constructor(
    message: string,
    readonly reason: "refusal" | "invalid",
    readonly inputTokens = 0,
    readonly outputTokens = 0,
  ) {
    super(message);
  }
}

type Check<T> = { ok: true; data: T } | { ok: false; problem: string };

/** Parse JSON, tolerating code fences or text around the object (cheap local repair). */
export function parseJsonLoose(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const unfenced = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    const start = unfenced.indexOf("{");
    const end = unfenced.lastIndexOf("}");
    if (start === -1 || end <= start) throw new SyntaxError("No JSON object found");
    return JSON.parse(unfenced.slice(start, end + 1));
  }
}

export function checkAnswer<T>(schema: z.ZodType<T>, text: string): Check<T> {
  let value: unknown;
  try {
    value = parseJsonLoose(text);
  } catch (err) {
    return { ok: false, problem: `The reply is not valid JSON (${(err as Error).message}).` };
  }
  const parsed = schema.safeParse(value);
  if (parsed.success) return { ok: true, data: parsed.data };

  const issues = parsed.error.issues
    .slice(0, 8)
    .map((i) => `- ${i.path.length ? i.path.join(".") : "(root)"}: ${i.message}`)
    .join("\n");
  return { ok: false, problem: `The JSON does not match the schema:\n${issues}` };
}

export async function completeWithRepair<T>(
  callModel: CallModel,
  schema: z.ZodType<T>,
  messages: ChatMessage[],
  { maxRepairs = 1 }: { maxRepairs?: number } = {},
): Promise<RepairResult<T>> {
  let history = [...messages];
  let inputTokens = 0;
  let outputTokens = 0;

  for (let attempt = 1; attempt <= maxRepairs + 1; attempt++) {
    const turn = await callModel(history);
    inputTokens += turn.inputTokens;
    outputTokens += turn.outputTokens;

    if (turn.stopReason === "refusal") {
      throw new ModelOutputError("The model declined to process these notes.", "refusal", inputTokens, outputTokens);
    }

    let problem: string;
    if (turn.stopReason === "max_tokens") {
      problem = "The reply was cut off because it was too long. Return the complete JSON again, but shorter.";
    } else {
      const check = checkAnswer(schema, turn.text);
      if (check.ok) return { data: check.data, attempts: attempt, inputTokens, outputTokens };
      problem = check.problem;
    }

    history = [
      ...history,
      ...(turn.text.trim() ? [{ role: "assistant" as const, content: turn.text }] : []),
      { role: "user", content: `${problem}\nReply with the corrected JSON only.` },
    ];
  }

  throw new ModelOutputError("The model's answer could not be validated.", "invalid", inputTokens, outputTokens);
}
