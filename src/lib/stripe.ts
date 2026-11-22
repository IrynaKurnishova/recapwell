import "server-only";
import Stripe from "stripe";
import { env } from "@/lib/env";

let client: Stripe | null = null;

/** Lazily created so builds don't need STRIPE_SECRET_KEY. */
export function getStripe() {
  if (!client) {
    const key = env.stripeSecretKey();
    if (!key.startsWith("sk_test_") && process.env.NODE_ENV !== "production") {
      throw new Error("Recapwell is a demo: use a Stripe test/sandbox key (sk_test_...).");
    }
    client = new Stripe(key, { appInfo: { name: "Recapwell (portfolio demo)" } });
  }
  return client;
}
