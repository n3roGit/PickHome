import type { ViewingScheduleWarning } from "@/lib/viewing-schedule-conflicts";

export function ViewingScheduleWarnings({ warnings }: { warnings: ViewingScheduleWarning[] }) {
  if (warnings.length === 0) return null;

  return (
    <ul className="mt-2 space-y-1.5">
      {warnings.map((w) => (
        <li
          key={`${w.kind}-${w.otherViewingId}`}
          className="text-sm text-pn-score-low bg-pn-score-low-bg border border-pn-score-low/25 rounded-lg px-3 py-2"
        >
          {w.message}
        </li>
      ))}
    </ul>
  );
}
