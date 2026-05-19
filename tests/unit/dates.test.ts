import { describe, expect, it } from "vitest";
import {
  datetimeLocalInputToIso,
  formatDateDe,
  formatDateTimeDe,
  parseDatetimeLocalInput,
  toDatetimeLocalValue,
} from "@/lib/dates";

describe("dates", () => {
  const date = new Date("2026-05-17T14:30:00");

  it("formats date in de-DE", () => {
    expect(formatDateDe(date)).toMatch(/17/);
    expect(formatDateDe(date)).toMatch(/2026/);
  });

  it("formats date and time in de-DE", () => {
    expect(formatDateTimeDe(date)).toMatch(/17/);
    expect(formatDateTimeDe(date)).toMatch(/14/);
  });

  it("builds datetime-local value", () => {
    expect(toDatetimeLocalValue(date)).toBe("2026-05-17T14:30");
  });

  it("round-trips datetime-local input to ISO", () => {
    const local = parseDatetimeLocalInput("2026-05-22T16:15");
    expect(local).not.toBeNull();
    expect(datetimeLocalInputToIso("2026-05-22T16:15")).toBe(local!.toISOString());
    expect(toDatetimeLocalValue(local!)).toBe("2026-05-22T16:15");
  });
});
