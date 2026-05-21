import { describe, expect, it } from "vitest";
import {
  formatTimestampForFileName,
  getCalendarPartsInTimeZone,
  isValidTimeZone,
  scheduledRunAtInTimeZone,
  wallTimeToUtc,
} from "@/lib/timezone";

describe("timezone validation", () => {
  it("accepts IANA zones", () => {
    expect(isValidTimeZone("Europe/Berlin")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
  });

  it("rejects invalid zones", () => {
    expect(isValidTimeZone("Not/A_Zone")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
  });
});

describe("wall time conversion", () => {
  it("maps Berlin summer wall time to UTC", () => {
    const utc = wallTimeToUtc(2026, 5, 21, 6, 0, 0, "Europe/Berlin");
    expect(utc.toISOString()).toBe("2026-05-21T04:00:00.000Z");
  });

  it("schedules backup run at configured local time", () => {
    const now = new Date("2026-05-21T05:00:00Z");
    const scheduled = scheduledRunAtInTimeZone(now, 6, 0, "Europe/Berlin");
    expect(scheduled.toISOString()).toBe("2026-05-21T04:00:00.000Z");
  });
});

describe("backup filename stamp", () => {
  it("uses app timezone instead of UTC ISO", () => {
    const stamp = formatTimestampForFileName(
      new Date("2026-05-21T04:00:03Z"),
      "Europe/Berlin"
    );
    expect(stamp).toBe("2026-05-21T06-00-03");
  });
});

describe("calendar parts", () => {
  it("reads date parts in timezone", () => {
    const parts = getCalendarPartsInTimeZone(
      new Date("2026-05-21T04:00:00Z"),
      "Europe/Berlin"
    );
    expect(parts).toMatchObject({ year: 2026, month: 5, day: 21, hour: 6, minute: 0 });
  });
});
