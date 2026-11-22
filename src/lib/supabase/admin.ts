import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import type { Database } from "@/lib/database.types";

/**
 * Supabase client with the secret key. It BYPASSES Row Level Security.
 * Use only in trusted server code (Stripe webhooks, billing sync, super-admin),
 * never with input you haven't checked, and never in Client Components.
 */
export function createAdminClient() {
  return createClient<Database>(env.supabaseUrl(), env.supabaseSecretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
