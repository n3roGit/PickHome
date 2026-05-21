import { DEFAULT_APP_TIME_ZONE } from "@/lib/timezone";

export function formatDateTimeDe(
  date: Date,
  timeZone: string = DEFAULT_APP_TIME_ZONE
): string {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(date);
}

export function formatDateDe(date: Date, timeZone: string = DEFAULT_APP_TIME_ZONE): string {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeZone,
  }).format(date);
}

export function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const DATETIME_LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** Parse `<input type="datetime-local">` value as local wall time (browser timezone). */
export function parseDatetimeLocalInput(value: string): Date | null {
  const match = DATETIME_LOCAL_RE.exec(value.trim());
  if (!match) return null;
  const [, y, mo, d, h, min] = match;
  const date = new Date(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(min),
    0,
    0
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Call in the browser before submitting a datetime-local field to the server. */
export function datetimeLocalInputToIso(value: string): string | null {
  const date = parseDatetimeLocalInput(value);
  return date ? date.toISOString() : null;
}

export function normalizeScheduledAtFormData(formData: FormData): void {
  const raw = String(formData.get("scheduledAt") ?? "").trim();
  if (!raw || raw.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(raw)) return;
  const iso = datetimeLocalInputToIso(raw);
  if (iso) formData.set("scheduledAt", iso);
}
