"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { safeNextPath } from "@/lib/safe-redirect";

export type AuthState = { error?: string; message?: string } | undefined;

function readCredentials(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." } as const;
  if (password.length < 8) return { error: "Password must be at least 8 characters." } as const;
  return { email, password } as const;
}

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const creds = readCredentials(formData);
  if ("error" in creds) return { error: creds.error };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(creds);
  if (error) return { error: error.message };

  redirect(safeNextPath(formData.get("next") as string | null));
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const creds = readCredentials(formData);
  if ("error" in creds) return { error: creds.error };

  const next = safeNextPath(formData.get("next") as string | null);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    ...creds,
    options: {
      emailRedirectTo: `${env.siteUrl()}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) return { error: error.message };

  // With "Confirm email" turned off in Supabase, a session is returned right away.
  if (data.session) redirect(next);

  return { message: "Check your inbox and click the link to confirm your email." };
}

export async function signInWithGoogle(formData: FormData) {
  const next = safeNextPath(formData.get("next") as string | null);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${env.siteUrl()}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error || !data.url) redirect("/auth/auth-code-error");
  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
