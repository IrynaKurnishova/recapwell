"use client";

import { useActionState } from "react";
import { acceptInvitation, type AcceptState } from "./actions";

export function AcceptButton({ token, orgName }: { token: string; orgName: string }) {
  const [state, action, pending] = useActionState<AcceptState, FormData>(acceptInvitation, undefined);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="token" value={token} />
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "Joining…" : `Join ${orgName}`}
      </button>
      {state?.error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
    </form>
  );
}
