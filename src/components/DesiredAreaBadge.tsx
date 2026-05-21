import type { AreaFilterMode, AreaMatchStatus } from "@/lib/area-filter";
import { areaFilterLabel } from "@/lib/area-filter";

const allowStyles: Record<Exclude<AreaMatchStatus, "unset">, string> = {
  inside: "text-pn-score-high bg-pn-score-high-bg",
  outside: "text-pn-text-secondary bg-pn-bg-subtle border border-pn-border",
  unknown: "text-amber-800 bg-amber-100",
};

const denyStyles: Record<Exclude<AreaMatchStatus, "unset">, string> = {
  inside: "text-pn-score-low bg-pn-score-low-bg",
  outside: "text-pn-score-high bg-pn-score-high-bg",
  unknown: "text-amber-800 bg-amber-100",
};

export function DesiredAreaBadge({
  status,
  mode = "allow",
  className = "",
}: {
  status: AreaMatchStatus;
  mode?: AreaFilterMode;
  className?: string;
}) {
  if (status === "unset") return null;

  const label = areaFilterLabel(status, mode);
  const styles = mode === "deny" ? denyStyles : allowStyles;
  return (
    <span
      className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${styles[status]} ${className}`}
      title={label}
    >
      {label}
    </span>
  );
}
