import type Stripe from "stripe";
import { env } from "@/lib/env";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { subscriptionIdFromEvent, syncSubscription } from "@/lib/billing/sync";

// Stripe → Recapwell. Locally: `npm run stripe:listen` forwards events here.
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Missing Stripe-Signature header", { status: 400 });

  // The signature is computed over the raw body, so read it as text (not JSON).
  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, env.stripeWebhookSecret());
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  const subscriptionId = subscriptionIdFromEvent(event);
  if (!subscriptionId) return Response.json({ received: true, ignored: event.type });

  // Idempotency: record the event first. If it's already there, Stripe is retrying
  // something we've processed, so acknowledge and do nothing.
  const admin = createAdminClient();
  const { data: inserted, error: insertError } = await admin
    .from("stripe_events")
    .upsert({ event_id: event.id, type: event.type }, { onConflict: "event_id", ignoreDuplicates: true })
    .select("event_id");
  if (insertError) {
    console.error("[stripe webhook] could not record event", insertError);
    return new Response("Database error", { status: 500 });
  }
  if (!inserted?.length) return Response.json({ received: true, duplicate: true });

  try {
    await syncSubscription(subscriptionId);
  } catch (err) {
    console.error(`[stripe webhook] ${event.type} ${event.id} failed`, err);
    // Forget the event so Stripe's automatic retry gets processed.
    await admin.from("stripe_events").delete().eq("event_id", event.id);
    return new Response("Handler failed", { status: 500 });
  }

  return Response.json({ received: true });
}
