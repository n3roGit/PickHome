import { scoreColor } from "@/lib/scoring";

export function ScoreBadge({
  score,
  dealbreaker,
}: {
  score: number;
  dealbreaker?: boolean;
}) {
  const color = scoreColor(score, dealbreaker ?? false);
  const classes = {
    high: "bg-pn-score-high-bg text-pn-score-high",
    mid: "bg-pn-score-mid-bg text-pn-score-mid",
    low: "bg-pn-score-low-bg text-pn-score-low",
  }[color];
  return (
    <span className={`font-bold tabular-nums text-sm px-2.5 py-0.5 rounded-full ${classes}`}>
      {dealbreaker ? "DB" : score}
      {!dealbreaker && <span className="font-normal opacity-70">/100</span>}
    </span>
  );
}
