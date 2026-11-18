import type { PostgrestError } from "@supabase/supabase-js";

// Errors raised on purpose in our SQL functions carry a user-friendly message.
const FRIENDLY_CODES = new Set(["P0001", "P0002", "23505", "28000"]);

/** Turns a Supabase/Postgres error into text that is safe to show in the UI. */
export function dbErrorMessage(error: PostgrestError, fallback = "Something went wrong. Please try again.") {
  if (FRIENDLY_CODES.has(error.code)) return error.message;

  // 42501 = insufficient privilege: either our own RPC message or an RLS/grant refusal.
  if (error.code === "42501") {
    const isSystem = /row-level security|permission denied/i.test(error.message);
    return isSystem ? "You don't have permission to do that." : error.message;
  }

  console.error("[db]", error);
  return fallback;
}
