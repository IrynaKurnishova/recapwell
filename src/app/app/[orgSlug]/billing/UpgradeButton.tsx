"use client";

import { useActionState } from "react";
import { startCheckout, type CheckoutState } from "./actions";
import type { BillingInterval } from "@/lib/billing/plans";

export function UpgradeButton({ orgId, interval, label }: { orgId: string; interval: BillingInterval; label: string }) {
  const [state, action, pending] = useActionState<CheckoutState, FormData>(startCheckout, undefined);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="orgId" value={orgId} />
      <input type="hidden" name="interval" value={interval} />
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "Opening Stripe…" : label}
      </button>
      {state?.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
    </form>
  );
}
