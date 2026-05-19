export function ScoreLegend({ className = "" }: { className?: string }) {
  return (
    <p
      className={`text-xs text-pn-text-tertiary flex flex-wrap gap-x-3 gap-y-1 ${className}`}
      aria-label="Score-Farben"
    >
      <span>
        <span className="text-pn-score-high font-medium">Grün</span> ≥ 71
      </span>
      <span>
        <span className="text-pn-score-mid font-medium">Gelb</span> 41–70
      </span>
      <span>
        <span className="text-pn-score-low font-medium">Rot</span> ≤ 40
      </span>
      <span>
        <span className="text-pn-score-low font-semibold">DB</span> = Dealbreaker
      </span>
    </p>
  );
}
