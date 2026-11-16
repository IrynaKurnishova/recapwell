import Link from "next/link";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
      <span aria-hidden className="grid size-7 place-items-center rounded-lg bg-brand text-sm font-bold text-white">
        R
      </span>
      recapwell
    </Link>
  );
}
