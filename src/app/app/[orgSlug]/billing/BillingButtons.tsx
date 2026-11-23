"use client";

import { useActionState } from "react";
import {
  openBillingPortal,
  setCancelAtPeriodEnd,
  startCheckout,
  type BillingState,
} from "./actions";
import type { BillingInterval } from "@/lib/billing/plans";

type Variant = "primary" | "secondary" | "danger";
const classes: Record<Variant, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  danger: "btn-secondary text-red-700 hover:bg-red-50",
};

function ActionForm({
  action,
  fields,
  label,
  pendingLabel,
  variant = "secondary",
  confirm,
  fullWidth,
}: {
  action: (prev: BillingState, formData: FormData) => Promise<BillingState>;
  fields: Record<string, string>;
  label: string;
  pendingLabel: string;
  variant?: Variant;
  confirm?: string;
  fullWidth?: boolean;
}) {
  const [state, formAction, pending] = useActionState<BillingState, FormData>(action, undefined);
  return (
    <form
      action={formAction}
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <button type="submit" disabled={pending} className={`${classes[variant]} ${fullWidth ? "w-full" : ""}`}>
        {pending ? pendingLabel : label}
      </button>
      {state?.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
    </form>
  );
}

export function UpgradeButton({ orgId, interval, label }: { orgId: string; interval: BillingInterval; label: string }) {
  return (
    <ActionForm
      action={startCheckout}
      fields={{ orgId, interval }}
      label={label}
      pendingLabel="Opening Stripe…"
      variant="primary"
      fullWidth
    />
  );
}

export function PortalButton({ orgId, label = "Manage billing" }: { orgId: string; label?: string }) {
  return <ActionForm action={openBillingPortal} fields={{ orgId }} label={label} pendingLabel="Opening Stripe…" />;
}

export function CancelButton({ orgId, endsOn }: { orgId: string; endsOn: string }) {
  return (
    <ActionForm
      action={setCancelAtPeriodEnd}
      fields={{ orgId, cancel: "true" }}
      label="Cancel subscription"
      pendingLabel="Cancelling…"
      variant="danger"
      confirm={`Cancel the Team plan? You keep Team features until ${endsOn}, then the workspace moves to Free.`}
    />
  );
}

export function ResumeButton({ orgId }: { orgId: string }) {
  return (
    <ActionForm
      action={setCancelAtPeriodEnd}
      fields={{ orgId, cancel: "false" }}
      label="Keep my Team plan"
      pendingLabel="Resuming…"
      variant="primary"
    />
  );
}
