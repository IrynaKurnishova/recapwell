"use server";

import { redirect } from "next/navigation";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { dbErrorMessage } from "@/lib/db-errors";
import { SLUG_PATTERN, slugify } from "@/lib/orgs-shared";

export type FormState = { error?: string } | undefined;

export async function createOrganization(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await getCurrentUser())) redirect("/login?next=/app/onboarding");

  const name = String(formData.get("name") ?? "").trim();
  const slug = slugify(String(formData.get("slug") ?? "") || name);

  if (!name) return { error: "Give your workspace a name." };
  if (!new RegExp(SLUG_PATTERN).test(slug)) {
    return { error: "The URL can use lowercase letters, numbers and dashes." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_organization", { p_name: name, p_slug: slug });
  if (error) return { error: dbErrorMessage(error) };

  redirect(`/app/${data.slug}`);
}
