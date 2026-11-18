"use client";

import { useActionState, useState } from "react";
import { createOrganization, type FormState } from "@/app/app/actions";
import { SLUG_PATTERN, slugify } from "@/lib/orgs-shared";

export function CreateOrgForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createOrganization, undefined);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Workspace name
        <input
          name="name"
          required
          maxLength={80}
          className="input"
          placeholder="Acme Studio"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!slugEdited) setSlug(slugify(e.target.value));
          }}
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        URL
        <div className="flex items-center rounded-lg border border-line bg-surface pl-3 text-sm focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20">
          <span className="text-ink-muted">recapwell.app/</span>
          <input
            name="slug"
            required
            pattern={SLUG_PATTERN}
            maxLength={48}
            className="min-w-0 flex-1 rounded-r-lg bg-white px-2 py-2 font-normal outline-none"
            value={slug}
            onChange={(e) => {
              setSlugEdited(true);
              setSlug(e.target.value.toLowerCase());
            }}
          />
        </div>
        <span className="text-xs font-normal text-ink-muted">Lowercase letters, numbers and dashes.</span>
      </label>

      {state?.error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "Creating…" : "Create workspace"}
      </button>
    </form>
  );
}
