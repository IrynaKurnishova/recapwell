"use client";

import { useActionState } from "react";
import { revokeInvitation, type ActionState } from "./actions";

export function RevokeInviteButton({ invitationId }: { invitationId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(revokeInvitation, undefined);
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="invitationId" value={invitationId} />
      <button type="submit" disabled={pending} className="text-sm font-medium text-red-600 hover:underline">
        Revoke
      </button>
      {state?.error && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  );
}
