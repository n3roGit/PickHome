/** Midpoints of meteorological seasons (Northern Hemisphere), month/day only. */

export type SolarSeasonId = "winter" | "spring" | "summer" | "autumn";

export type SolarSeasonMidpoint = {
  id: SolarSeasonId;
  label: string;
  month: number;
  day: number;
};

export const SOLAR_SEASON_MIDPOINTS: readonly SolarSeasonMidpoint[] = [
  { id: "winter", label: "Winter", month: 1, day: 15 },
  { id: "spring", label: "Frühling", month: 4, day: 15 },
  { id: "summer", label: "Sommer", month: 7, day: 15 },
  { id: "autumn", label: "Herbst", month: 10, day: 15 },
] as const;

export function toDateInputValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseDateInput(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y!, m! - 1, d!, 12, 0, 0, 0);
}

const DATE_QUERY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseOptionalDateQuery(value: string | undefined): Date | undefined {
  if (!value || !DATE_QUERY_RE.test(value)) return undefined;
  const parsed = parseDateInput(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export function getSeasonMidDate(referenceDate: Date, seasonId: SolarSeasonId): Date {
  const spec = SOLAR_SEASON_MIDPOINTS.find((s) => s.id === seasonId);
  if (!spec) {
    return new Date(referenceDate);
  }
  return new Date(referenceDate.getFullYear(), spec.month - 1, spec.day, 12, 0, 0, 0);
}

export function buildSolarArHref(baseHref: string, dayDate: Date): string {
  const q = new URLSearchParams({ date: toDateInputValue(dayDate) });
  return `${baseHref}?${q.toString()}`;
}
