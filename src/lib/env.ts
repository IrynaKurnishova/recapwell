function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing environment variable ${name}. Copy .env.example to .env.local and fill it in.`);
  }
  return value;
}

// NEXT_PUBLIC_* vars must be referenced literally so Next.js can inline them in the browser bundle.
export const env = {
  supabaseUrl: () => required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseKey: () =>
    required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
  siteUrl: () => process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",

  // Server-only secrets. Never prefix these with NEXT_PUBLIC_.
  supabaseSecretKey: () => required("SUPABASE_SECRET_KEY", process.env.SUPABASE_SECRET_KEY),
  stripeSecretKey: () => required("STRIPE_SECRET_KEY", process.env.STRIPE_SECRET_KEY),
  stripeWebhookSecret: () => required("STRIPE_WEBHOOK_SECRET", process.env.STRIPE_WEBHOOK_SECRET),
  anthropicApiKey: () => required("ANTHROPIC_API_KEY", process.env.ANTHROPIC_API_KEY),
  /** Model for recaps. Haiku 5.5 is fast and cheap; switch to claude-sonnet-5-5 for harder notes. */
  anthropicModel: () => process.env.ANTHROPIC_MODEL || "claude-haiku-5-5",
};
