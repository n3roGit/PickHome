import { describe, expect, it } from "vitest";
import {
  isListingPriceSyncDue,
  listingPriceSyncCycleStart,
} from "@/lib/listing-price-sync";

describe("listing price sync schedule", () => {
  const timeZone = "Europe/Berlin";

  it("is due after scheduled time when never run", () => {
    const now = new Date("2026-05-21T10:00:00+02:00");
    expect(
      isListingPriceSyncDue({ enabled: true, hour: 6, minute: 0, lastRunAt: null }, now, timeZone)
    ).toBe(true);
  });

  it("is not due before scheduled time", () => {
    const now = new Date("2026-05-21T05:00:00+02:00");
    expect(
      isListingPriceSyncDue({ enabled: true, hour: 6, minute: 0, lastRunAt: null }, now, timeZone)
    ).toBe(false);
  });

  it("is not due again after a run in the same cycle", () => {
    const now = new Date("2026-05-21T10:00:00+02:00");
    const lastRun = new Date("2026-05-21T07:00:00+02:00");
    expect(
      isListingPriceSyncDue(
        { enabled: true, hour: 6, minute: 0, lastRunAt: lastRun },
        now,
        timeZone
      )
    ).toBe(false);
  });

  it("is due again on the next day", () => {
    const now = new Date("2026-05-22T10:00:00+02:00");
    const lastRun = new Date("2026-05-21T07:00:00+02:00");
    expect(
      isListingPriceSyncDue(
        { enabled: true, hour: 6, minute: 0, lastRunAt: lastRun },
        now,
        timeZone
      )
    ).toBe(true);
  });

  it("uses cycle start at configured wall time", () => {
    const now = new Date("2026-05-21T10:00:00+02:00");
    const cycleStart = listingPriceSyncCycleStart({ hour: 6, minute: 30 }, now, timeZone);
    expect(cycleStart.getTime()).toBeLessThan(now.getTime());
  });
});
