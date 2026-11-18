import { signOut } from "@/app/auth/actions";

export function UserMenu({ email }: { email: string }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="hidden max-w-48 truncate text-ink-muted md:inline">{email}</span>
      <form action={signOut}>
        <button type="submit" className="btn-secondary">
          Sign out
        </button>
      </form>
    </div>
  );
}
