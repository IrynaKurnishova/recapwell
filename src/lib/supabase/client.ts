import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/lib/env";
import type { Database } from "@/lib/database.types";

/** Supabase client for Client Components. */
export function createClient() {
  return createBrowserClient<Database>(env.supabaseUrl(), env.supabaseKey());
}
