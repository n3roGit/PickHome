export const TRANSIT_FALLBACK_MODES = ["foot", "bike"] as const;

export type TransitFallbackMode = (typeof TRANSIT_FALLBACK_MODES)[number];

export const TRANSIT_WEEKDAYS = [
  { value: 1, label: "Montag" },
  { value: 2, label: "Dienstag" },
  { value: 3, label: "Mittwoch" },
  { value: 4, label: "Donnerstag" },
  { value: 5, label: "Freitag" },
  { value: 6, label: "Samstag" },
  { value: 7, label: "Sonntag" },
] as const;

export type TransitSettings = {
  arrivalWeekday: number;
  arrivalHour: number;
  arrivalMinute: number;
  fallbackMaxKm: number | null;
  fallbackMode: TransitFallbackMode | null;
};

export const DEFAULT_TRANSIT_ARRIVAL_HOUR = 8;
export const DEFAULT_TRANSIT_ARRIVAL_MINUTE = 0;
export const DEFAULT_TRANSIT_ARRIVAL_WEEKDAY = 1;
export const DEFAULT_TRANSIT_FALLBACK_MAX_KM = 5;

export function parseTransitArrivalHour(raw: string | null | undefined): number {
  const n = parseInt(String(raw ?? "").trim(), 10);
  if (!Number.isFinite(n) || n < 0 || n > 23) return DEFAULT_TRANSIT_ARRIVAL_HOUR;
  return n;
}

export function parseTransitArrivalMinute(raw: string | null | undefined): number {
  const n = parseInt(String(raw ?? "").trim(), 10);
  if (!Number.isFinite(n) || n < 0 || n > 59) return DEFAULT_TRANSIT_ARRIVAL_MINUTE;
  return n;
}

export function parseTransitArrivalWeekday(raw: string | null | undefined): number {
  const n = parseInt(String(raw ?? "").trim(), 10);
  if (!Number.isFinite(n) || n < 1 || n > 7) return DEFAULT_TRANSIT_ARRIVAL_WEEKDAY;
  return n;
}

export function parseTransitFallbackMaxKm(raw: string | null | undefined): number | null {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return null;
  const n = parseInt(trimmed, 10);
  if (!Number.isFinite(n) || n < 0) return null;
  if (n === 0) return 0;
  return Math.min(n, 50);
}

export function parseTransitFallbackMode(raw: string | null | undefined): TransitFallbackMode | null {
  const value = String(raw ?? "").trim().toLowerCase();
  if (value === "" || value === "none") return null;
  return TRANSIT_FALLBACK_MODES.includes(value as TransitFallbackMode)
    ? (value as TransitFallbackMode)
    : null;
}

export function transitFallbackModeLabel(mode: TransitFallbackMode): string {
  return mode === "foot" ? "Zu Fuß" : "Rad";
}

export function transitWeekdayLabel(weekday: number): string {
  return TRANSIT_WEEKDAYS.find((d) => d.value === weekday)?.label ?? "Montag";
}

export function formatTransitArrivalTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function resolveTransitSettings(user: {
  transitArrivalHour: number | null;
  transitArrivalMinute: number | null;
  transitArrivalWeekday: number | null;
  transitFallbackMaxKm: number | null;
  transitFallbackMode: string | null;
}): TransitSettings {
  return {
    arrivalHour: parseTransitArrivalHour(
      user.transitArrivalHour != null ? String(user.transitArrivalHour) : null
    ),
    arrivalMinute: parseTransitArrivalMinute(
      user.transitArrivalMinute != null ? String(user.transitArrivalMinute) : null
    ),
    arrivalWeekday: parseTransitArrivalWeekday(
      user.transitArrivalWeekday != null ? String(user.transitArrivalWeekday) : null
    ),
    fallbackMaxKm:
      user.transitFallbackMaxKm != null
        ? user.transitFallbackMaxKm
        : DEFAULT_TRANSIT_FALLBACK_MAX_KM,
    fallbackMode:
      parseTransitFallbackMode(user.transitFallbackMode) ?? "bike",
  };
}

/** Next calendar occurrence of weekday (1=Mon … 7=Sun) at local time in Europe/Berlin. */
export function nextTransitArrivalDate(
  weekday: number,
  hour: number,
  minute: number,
  now: Date = new Date()
): Date {
  const timeZone = "Europe/Berlin";
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  });

  const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
  const targetName = weekdayNames[weekday % 7];

  for (let offset = 0; offset < 14; offset++) {
    const candidate = new Date(now.getTime() + offset * 24 * 60 * 60 * 1000);
    const parts = formatter.formatToParts(candidate);
    const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    const candidateWeekday = part("weekday");
    if (candidateWeekday !== targetName) continue;

    const y = parseInt(part("year"), 10);
    const m = parseInt(part("month"), 10);
    const d = parseInt(part("day"), 10);

    const utcGuess = Date.UTC(y, m - 1, d, hour - 1, minute, 0);
    let arrival = new Date(utcGuess);
    for (let i = 0; i < 4; i++) {
      const check = formatter.formatToParts(arrival);
      const checkHour = parseInt(check.find((p) => p.type === "hour")?.value ?? "0", 10);
      const checkMinute = parseInt(check.find((p) => p.type === "minute")?.value ?? "0", 10);
      if (checkHour === hour && checkMinute === minute) break;
      arrival = new Date(arrival.getTime() + (hour - checkHour) * 60 * 60 * 1000);
      arrival = new Date(arrival.getTime() + (minute - checkMinute) * 60 * 1000);
    }

    if (arrival.getTime() > now.getTime()) {
      return arrival;
    }
  }

  return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
}

export function formatTransitArrivalForApi(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}:00+02:00`;
}

export function shouldUseTransitOsrmFallback(
  distanceMeters: number,
  settings: Pick<TransitSettings, "fallbackMaxKm" | "fallbackMode">
): boolean {
  if (settings.fallbackMaxKm == null || settings.fallbackMaxKm <= 0 || settings.fallbackMode == null) {
    return false;
  }
  return distanceMeters <= settings.fallbackMaxKm * 1000;
}

export function transitRoutingNote(
  fallbackMode: TransitFallbackMode,
  maxKm: number
): string {
  return `Kurze Strecke (≤ ${maxKm} km) — ${transitFallbackModeLabel(fallbackMode)} statt ÖPNV`;
}

export type CommuteRouteKind = "osrm" | "transit" | "transit_fallback";

export function parseCommuteRouteKind(raw: string | null | undefined): CommuteRouteKind | null {
  if (raw === "osrm" || raw === "transit" || raw === "transit_fallback") return raw;
  return null;
}
