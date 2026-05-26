"use client";

import {
  getSeasonMidDate,
  SOLAR_SEASON_MIDPOINTS,
  toDateInputValue,
  parseDateInput,
  type SolarSeasonId,
} from "@/lib/solar-seasons";

type Props = {
  dayDate: Date;
  onDayDateChange: (date: Date) => void;
  variant?: "light" | "dark";
  showDateLabel?: boolean;
};

export function SolarSeasonDateControls({
  dayDate,
  onDayDateChange,
  variant = "light",
  showDateLabel = true,
}: Props) {
  const isDark = variant === "dark";

  function pickSeason(seasonId: SolarSeasonId) {
    onDayDateChange(getSeasonMidDate(dayDate, seasonId));
  }

  const inputClass = isDark
    ? "border border-white/30 rounded-lg px-2 py-1.5 text-sm bg-black/40 text-white"
    : "border border-pn-border rounded-lg px-3 py-2 text-sm bg-pn-bg-surface";

  const seasonBtnClass = isDark
    ? "text-xs px-2.5 py-1.5 rounded-lg border border-white/30 bg-black/40 hover:bg-white/10 text-white min-h-[36px]"
    : "text-xs px-2.5 py-1.5 rounded-lg border border-pn-border bg-pn-bg-subtle hover:bg-pn-bg-surface text-pn-text-primary min-h-[36px]";

  return (
    <div className="space-y-2" data-testid="solar-season-controls">
      <label className="flex flex-col gap-1 min-w-0">
        {showDateLabel && (
          <span
            className={
              isDark ? "text-xs text-white/70" : "text-xs text-pn-text-tertiary"
            }
          >
            Datum
          </span>
        )}
        <input
          type="date"
          value={toDateInputValue(dayDate)}
          onChange={(e) => onDayDateChange(parseDateInput(e.target.value))}
          data-testid="solar-date-input"
          className={inputClass}
        />
      </label>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Jahreszeit">
        {SOLAR_SEASON_MIDPOINTS.map((season) => (
          <button
            key={season.id}
            type="button"
            data-testid={`solar-season-${season.id}`}
            onClick={() => pickSeason(season.id)}
            className={seasonBtnClass}
          >
            {season.label}
          </button>
        ))}
      </div>
    </div>
  );
}
