"use client";

const SCORE_VALUES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

function unratedButtonClass(active: boolean): string {
  const base =
    "w-11 h-11 shrink-0 rounded-lg border text-sm font-bold tabular-nums touch-manipulation transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  if (active) {
    return `${base} bg-pn-bg-subtle border-pn-border text-pn-text-secondary`;
  }
  return `${base} bg-pn-bg-surface border-pn-border text-pn-text-tertiary hover:border-pn-border-strong`;
}

function scoreCellClass(active: boolean, inRange: boolean): string {
  const base =
    "flex-1 min-w-0 h-11 px-0.5 text-[11px] sm:text-xs font-semibold tabular-nums touch-manipulation transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  if (active) {
    return `${base} bg-pn-accent text-white relative z-[1] shadow-sm`;
  }
  if (inRange) {
    return `${base} bg-pn-accent/20 text-pn-accent`;
  }
  return `${base} bg-pn-bg-surface text-pn-text-tertiary hover:bg-pn-bg-subtle`;
}

export function RatingScalePicker({
  score,
  disabled,
  onChange,
}: {
  score: number | null;
  disabled?: boolean;
  onChange: (score: number | null) => void;
}) {
  const unrated = score == null;

  return (
    <div className="flex items-center gap-2 w-full min-w-0">
      <button
        type="button"
        aria-pressed={unrated}
        aria-label="Nicht bewertet"
        title="Nicht bewertet"
        disabled={disabled}
        className={unratedButtonClass(unrated)}
        onClick={() => {
          if (!disabled && !unrated) onChange(null);
        }}
      >
        —
      </button>

      <div
        role="radiogroup"
        aria-label="Bewertung 0 bis 10"
        className="flex flex-1 min-w-0 rounded-lg border border-pn-border overflow-hidden divide-x divide-pn-border"
      >
        {SCORE_VALUES.map((n) => {
          const active = score === n;
          const inRange = score != null && n < score;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={`${n} von 10`}
              disabled={disabled}
              className={scoreCellClass(active, inRange)}
              onClick={() => {
                if (!disabled && score !== n) onChange(n);
              }}
            >
              {n}
            </button>
          );
        })}
      </div>

      <span
        className="w-9 text-center text-lg font-bold tabular-nums text-pn-text-primary shrink-0"
        aria-hidden
      >
        {unrated ? "—" : score}
      </span>
    </div>
  );
}
