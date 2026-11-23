import Link from "next/link";

/** Shown on every workspace page while Stripe is retrying a failed payment. */
export function PastDueBanner({ slug, canManage }: { slug: string; canManage: boolean }) {
  return (
    <div role="alert" className="border-b border-red-200 bg-red-50">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-6 py-2.5 text-sm text-red-800">
        <p>
          <strong>Payment failed.</strong> Stripe will retry the card. Team features stay on for now.
        </p>
        {canManage ? (
          <Link href={`/app/${slug}/billing`} className="font-medium underline">
            Update payment method
          </Link>
        ) : (
          <span>Ask an owner or admin to update the card.</span>
        )}
      </div>
    </div>
  );
}
