export const DEFAULT_APP_TIME_ZONE = "Europe/Berlin";

export const APP_TIME_ZONE_OPTIONS = [
  { value: "Europe/Berlin", label: "Europe/Berlin (MEZ/MESZ)" },
  { value: "Europe/Vienna", label: "Europe/Vienna" },
  { value: "Europe/Zurich", label: "Europe/Zurich" },
  { value: "Europe/Amsterdam", label: "Europe/Amsterdam" },
  { value: "Europe/Paris", label: "Europe/Paris" },
  { value: "Europe/London", label: "Europe/London" },
  { value: "UTC", label: "UTC" },
] as const;

export function isValidTimeZone(timeZone: string): boolean {
  if (!timeZone.trim()) return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function getCalendarPartsInTimeZone(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const part = (type: string) =>
    parseInt(parts.find((p) => p.type === type)?.value ?? "0", 10);
  return {
    year: part("year"),
    month: part("month"),
    day: part("day"),
    hour: part("hour"),
    minute: part("minute"),
    second: part("second"),
  };
}

/** UTC instant for a wall-clock time on a calendar day in the given IANA timezone. */
export function wallTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string
): Date {
  let result = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  for (let attempt = 0; attempt < 8; attempt++) {
    const parts = formatter.formatToParts(result);
    const get = (type: string) =>
      parseInt(parts.find((p) => p.type === type)?.value ?? "0", 10);
    const cy = get("year");
    const cm = get("month");
    const cd = get("day");
    const ch = get("hour");
    const cmin = get("minute");
    const cs = get("second");
    if (
      cy === year &&
      cm === month &&
      cd === day &&
      ch === hour &&
      cmin === minute &&
      cs === second
    ) {
      return result;
    }
    result = new Date(
      result.getTime() +
        (hour - ch) * 3_600_000 +
        (minute - cmin) * 60_000 +
        (second - cs) * 1_000
    );
  }

  return result;
}

export function scheduledRunAtInTimeZone(
  reference: Date,
  hour: number,
  minute: number,
  timeZone: string
): Date {
  const { year, month, day } = getCalendarPartsInTimeZone(reference, timeZone);
  return wallTimeToUtc(year, month, day, hour, minute, 0, timeZone);
}

export function formatTimestampForFileName(date: Date, timeZone: string): string {
  const { year, month, day, hour, minute, second } = getCalendarPartsInTimeZone(
    date,
    timeZone
  );
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}-${pad(minute)}-${pad(second)}`;
}
