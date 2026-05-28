import type { LocationInsightWarning } from "@/lib/location-insights";

const WARNING_STYLES: Record<LocationInsightWarning["kind"], string> = {
  flood_hq100: "bg-pn-score-low-bg text-pn-score-low border-pn-score-low/30",
  flood_hqextrem: "bg-pn-score-mid-bg text-pn-score-mid border-pn-border",
  noise_65: "bg-pn-score-mid-bg text-pn-score-mid border-pn-border",
  noise_70: "bg-pn-score-low-bg text-pn-score-low border-pn-score-low/30",
  air_poor: "bg-amber-100 text-amber-900 border-amber-300/50 dark:bg-amber-950/50 dark:text-amber-200 dark:border-amber-800/50",
  radon_elevated: "bg-pn-score-mid-bg text-pn-score-mid border-pn-border",
  radon_precaution: "bg-pn-score-low-bg text-pn-score-low border-pn-score-low/30",
};

export function LocationInsightWarnings({ warnings }: { warnings: LocationInsightWarning[] }) {
  if (warnings.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {warnings.map((w) => (
        <a
          key={w.kind}
          href="#location-insights"
          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold hover:opacity-90 ${WARNING_STYLES[w.kind]}`}
        >
          {w.label}
        </a>
      ))}
    </div>
  );
}
