export function RatingProgressBar({
  rated,
  total,
  className = "",
  label = "Kriterien",
}: {
  rated: number;
  total: number;
  className?: string;
  label?: string;
}) {
  const pct = total > 0 ? Math.round((rated / total) * 100) : 0;
  return (
    <div className={`w-full min-w-[120px] ${className}`}>
      <div className="flex justify-between text-xs text-pn-text-tertiary mb-1 tabular-nums">
        <span>
          {rated}/{total} {label}
        </span>
        <span>{pct}%</span>
      </div>
      <div
        className="h-1.5 rounded-full bg-pn-bg-subtle overflow-hidden"
        role="progressbar"
        aria-valuenow={rated}
        aria-valuemin={0}
        aria-valuemax={total}
      >
        <div
          className="h-full rounded-full bg-pn-accent transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
