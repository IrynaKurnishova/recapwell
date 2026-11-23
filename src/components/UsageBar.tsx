export function UsageBar({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 100;
  const tone = pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-brand";
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-ink-muted">{label}</span>
        <span className="font-medium">
          {used} / {limit}
        </span>
      </div>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-surface"
        role="progressbar"
        aria-label={label}
        aria-valuenow={used}
        aria-valuemin={0}
        aria-valuemax={limit}
      >
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
