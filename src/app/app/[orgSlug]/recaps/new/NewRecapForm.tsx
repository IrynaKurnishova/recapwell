"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createRecap, type CreateRecapState } from "../actions";

const EXAMPLE = `Weekly product sync, 24 Nov
- Checkout redesign: Maria says mobile conversion dropped 4% after last release, needs a fix before Black Friday
- Agreed to roll back the new address form on mobile only
- Tom will check the analytics events by Wednesday
- Pricing page copy still open — waiting for legal
- Next sync Monday`;

export function NewRecapForm({ slug, canManageBilling }: { slug: string; canManageBilling: boolean }) {
  const [state, action, pending] = useActionState<CreateRecapState, FormData>(
    createRecap.bind(null, slug),
    undefined,
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Title</span>
        <input
          name="title"
          required
          maxLength={200}
          defaultValue={state?.title}
          placeholder="Weekly product sync"
          className="input"
          disabled={pending}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="flex items-baseline justify-between text-sm">
          <span className="font-medium">Meeting notes</span>
          <span className="text-ink-muted">Rough notes are fine</span>
        </span>
        <textarea
          name="notes"
          required
          minLength={40}
          maxLength={20000}
          rows={14}
          defaultValue={state?.notes}
          placeholder={EXAMPLE}
          className="input font-mono text-sm leading-relaxed"
          disabled={pending}
        />
      </label>

      {state?.error && (
        <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          <p>{state.error}</p>
          {state.limitReached &&
            (canManageBilling ? (
              <Link href={`/app/${slug}/billing`} className="mt-1 inline-block font-medium underline">
                Upgrade to Team for 300 recaps a month
              </Link>
            ) : (
              <p className="mt-1">Ask an owner or admin to upgrade the workspace.</p>
            ))}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Generating recap…" : "Generate recap"}
        </button>
        {pending && (
          <span role="status" className="text-sm text-ink-muted">
            Claude is reading your notes. This usually takes 5–15 seconds.
          </span>
        )}
      </div>
    </form>
  );
}
