"use client";

import { useActionState } from "react";
import { changeRole, removeMember, type ActionState } from "./actions";
import { ROLE_LABELS, type OrgRole } from "@/lib/orgs-shared";

type Props = {
  orgId: string;
  userId: string;
  name: string;
  email: string;
  role: OrgRole;
  isMe: boolean;
  canEditRole: boolean;
  canRemove: boolean;
  assignableRoles: OrgRole[];
};

export function MemberRow(props: Props) {
  const { orgId, userId, name, email, role, isMe, canEditRole, canRemove, assignableRoles } = props;
  const [roleState, roleAction, rolePending] = useActionState<ActionState, FormData>(changeRole, undefined);
  const [removeState, removeAction, removePending] = useActionState<ActionState, FormData>(removeMember, undefined);
  const error = roleState?.error ?? removeState?.error;

  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="grid size-9 shrink-0 place-items-center rounded-full bg-brand/10 text-sm font-semibold text-brand">
          {(name || email).charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">
            {name || email}
            {isMe && <span className="ml-2 rounded-full bg-surface px-2 py-0.5 text-xs text-ink-muted">You</span>}
          </p>
          {name && <p className="truncate text-sm text-ink-muted">{email}</p>}
        </div>

        {canEditRole ? (
          <form action={roleAction}>
            <input type="hidden" name="orgId" value={orgId} />
            <input type="hidden" name="userId" value={userId} />
            <select
              name="role"
              defaultValue={role}
              disabled={rolePending}
              aria-label={`Role for ${name || email}`}
              className="input py-1.5"
              onChange={(e) => e.currentTarget.form?.requestSubmit()}
            >
              {assignableRoles.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </form>
        ) : (
          <span className="rounded-full bg-surface px-3 py-1 text-sm text-ink-muted">{ROLE_LABELS[role]}</span>
        )}

        {canRemove && (
          <form
            action={removeAction}
            onSubmit={(e) => {
              const question = isMe ? "Leave this workspace?" : `Remove ${name || email} from this workspace?`;
              if (!window.confirm(question)) e.preventDefault();
            }}
          >
            <input type="hidden" name="orgId" value={orgId} />
            <input type="hidden" name="userId" value={userId} />
            <button type="submit" disabled={removePending} className="text-sm font-medium text-red-600 hover:underline">
              {isMe ? "Leave" : "Remove"}
            </button>
          </form>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
    </li>
  );
}
