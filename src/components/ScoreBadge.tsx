import { scoreColor } from "@/lib/scoring";

export function ScoreBadge({
  score,
  displayScore,
  dealbreaker,
}: {
  score: number;
  displayScore?: number;
  dealbreaker?: boolean;
}) {
  const shown = displayScore ?? score;
  const scoreColorKey = scoreColor(shown, false);
  const scoreClasses = {
    high: "bg-pn-score-high-bg text-pn-score-high",
    mid: "bg-pn-score-mid-bg text-pn-score-mid",
    low: "bg-pn-score-low-bg text-pn-score-low",
  }[scoreColorKey];

  if (dealbreaker) {
    return (
      <span className="inline-flex items-center gap-2">
        <span className={`font-bold tabular-nums text-sm px-2.5 py-0.5 rounded-full ${scoreClasses}`}>
          {shown}
          <span className="font-normal opacity-70">/100</span>
        </span>
        <span className="font-bold tabular-nums text-sm px-2.5 py-0.5 rounded-full bg-pn-score-low-bg text-pn-score-low">
          DB
        </span>
      </span>
    );
  }

  const color = scoreColor(score, false);
  const classes = {
    high: "bg-pn-score-high-bg text-pn-score-high",
    mid: "bg-pn-score-mid-bg text-pn-score-mid",
    low: "bg-pn-score-low-bg text-pn-score-low",
  }[color];

  return (
    <span className={`font-bold tabular-nums text-sm px-2.5 py-0.5 rounded-full ${classes}`}>
      {score}
      <span className="font-normal opacity-70">/100</span>
    </span>
  );
}
