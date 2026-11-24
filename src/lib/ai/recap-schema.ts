import * as z from "zod/v4";

/**
 * What Claude returns for a recap. The same schema is:
 *  - sent to the API as a JSON schema (structured outputs), and
 *  - used to validate the answer on our side, including the limits the API
 *    can't enforce itself (string lengths, list sizes).
 * Optional values are `nullable`, not `optional`: every key is always present.
 * The shape matches the seed data and what the MCP server reads.
 */
const actionItem = z.object({
  text: z.string().trim().min(1).max(500).describe("One concrete task, starting with a verb."),
  owner: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .nullable()
    .describe("Name of the person responsible, as written in the notes. null if nobody is named."),
  due_date: z.iso
    .date()
    .nullable()
    .describe("YYYY-MM-DD, only if the notes give or clearly imply a specific date. Otherwise null."),
});

const followupEmail = z.object({
  subject: z.string().trim().min(1).max(150),
  body: z.string().trim().min(1).max(4000).describe("Plain-text email to the attendees. No placeholders like [Name]."),
});

const base = {
  summary: z.string().trim().min(1).max(1200).describe("2–4 sentences: what the meeting was about and where it landed."),
  decisions: z.array(z.string().trim().min(1).max(300)).max(10).describe("Decisions that were actually made."),
  open_questions: z.array(z.string().trim().min(1).max(300)).max(10).describe("Questions left unresolved."),
  action_items: z.array(actionItem).max(20),
};

export const recapSchema = z.object(base);
export const recapWithEmailSchema = z.object({ ...base, followup_email: followupEmail });

export type FollowupEmail = z.infer<typeof followupEmail>;
export type RecapOutput = z.infer<typeof recapSchema> & { followup_email?: FollowupEmail };

export function schemaFor(withEmail: boolean): z.ZodType<RecapOutput> {
  return withEmail ? recapWithEmailSchema : recapSchema;
}

/**
 * For pages: read a stored `recaps.output` defensively. Seed rows and older rows
 * may miss fields (e.g. action items without due_date), so this is looser than
 * the schema we demand from Claude.
 */
const storedOutput = z
  .object({
    summary: z.string().catch(""),
    decisions: z.array(z.string()).catch([]),
    open_questions: z.array(z.string()).catch([]),
    followup_email: z.object({ subject: z.string(), body: z.string() }).optional().catch(undefined),
  })
  .loose();

export type StoredRecap = z.infer<typeof storedOutput>;

export function readStoredOutput(output: unknown): StoredRecap {
  const parsed = storedOutput.safeParse(output ?? {});
  return parsed.success ? parsed.data : { summary: "", decisions: [], open_questions: [] };
}

/** Form input for a new recap. */
export const recapInputSchema = z.object({
  title: z.string().trim().min(1, "Give the recap a title.").max(200, "Keep the title under 200 characters."),
  notes: z
    .string()
    .trim()
    .min(40, "Paste a bit more of the meeting notes (at least 40 characters).")
    .max(20000, "Notes are too long (max 20,000 characters)."),
});
