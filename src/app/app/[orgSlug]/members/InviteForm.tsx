"use client";

import { useActionState } from "react";
import { inviteMember, type ActionState } from "./actions";
import { CopyButton } from "@/components/CopyButton";

export function InviteForm({ orgId, disabled }: { orgId: string; disabled: boolean }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(inviteMember, undefined);

  return (
    <div className="flex flex-col gap-3">
      <form action={action} className="flex flex-col gap-3 sm:flex-row">
        <input type="hidden" name="orgId" value={orgId} />
        <input
          name="email"
          type="email"
          required
          placeholder="teammate@company.com"
          aria-label="Email"
          className="input flex-1"
          disabled={disabled}
        />
        <select name="role" defaultValue="member" aria-label="Role" className="input" disabled={disabled}>
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </select>
        <button type="submit" className="btn-primary" disabled={disabled || pending}>
          {pending ? "Inviting…" : "Create invite link"}
        </button>
      </form>

      {state?.error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      {state?.inviteLink && (
        <div role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <p>
            Invite for <strong>{state.inviteEmail}</strong> is ready. Send them this link (valid for 7 days):
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded bg-white px-2 py-1 text-xs">{state.inviteLink}</code>
            <CopyButton text={state.inviteLink} />
          </div>
        </div>
      )}
    </div>
  );
}
