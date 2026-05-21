import { describe, expect, it } from "vitest";
import {
  datetimeLocalInputToIso,
  formatDateDe,
  formatDateTimeDe,
  parseDatetimeLocalInput,
  toDatetimeLocalValue,
} from "@/lib/dates";

describe("dates", () => {
  const date = new Date("2026-05-17T12:30:00Z");
  const timeZone = "Europe/Berlin";

  it("formats date in de-DE", () => {
    expect(formatDateDe(date, timeZone)).toMatch(/17/);
    expect(formatDateDe(date, timeZone)).toMatch(/2026/);
  });

  it("formats date and time in de-DE", () => {
    expect(formatDateTimeDe(date, timeZone)).toMatch(/17/);
    expect(formatDateTimeDe(date, timeZone)).toMatch(/14/);
  });

  it("builds datetime-local value from system local wall time", () => {
    const local = new Date(2026, 4, 17, 14, 30, 0, 0);
    expect(toDatetimeLocalValue(local)).toBe("2026-05-17T14:30");
  });

  it("round-trips datetime-local input to ISO", () => {
    const local = parseDatetimeLocalInput("2026-05-22T16:15");
    expect(local).not.toBeNull();
    expect(datetimeLocalInputToIso("2026-05-22T16:15")).toBe(local!.toISOString());
    expect(toDatetimeLocalValue(local!)).toBe("2026-05-22T16:15");
  });
});
