import { describe, expect, it } from "vitest";
import {
  buildTransitLegDetails,
  formatConnectionSummary,
  formatTransitDetailTooltip,
  formatTransitLegDetailLine,
  journeyDurationSeconds,
} from "@/lib/transit-routing";
import {
  formatTransitArrivalForApi,
  nextTransitArrivalDate,
  parseTransitFallbackMaxKm,
  parseTransitFallbackMode,
  shouldUseTransitOsrmFallback,
  transitRoutingNote,
} from "@/lib/transit-settings";

describe("transit settings", () => {
  it("parses fallback km and mode", () => {
    expect(parseTransitFallbackMaxKm("5")).toBe(5);
    expect(parseTransitFallbackMaxKm("0")).toBe(0);
    expect(parseTransitFallbackMaxKm("")).toBeNull();
    expect(parseTransitFallbackMode("bike")).toBe("bike");
    expect(parseTransitFallbackMode("none")).toBeNull();
  });

  it("detects OSRM fallback under threshold", () => {
    expect(
      shouldUseTransitOsrmFallback(2000, { fallbackMaxKm: 5, fallbackMode: "bike" })
    ).toBe(true);
    expect(
      shouldUseTransitOsrmFallback(6000, { fallbackMaxKm: 5, fallbackMode: "bike" })
    ).toBe(false);
    expect(
      shouldUseTransitOsrmFallback(2000, { fallbackMaxKm: null, fallbackMode: "bike" })
    ).toBe(false);
  });

  it("builds routing note for fallback", () => {
    expect(transitRoutingNote("bike", 5)).toContain("5 km");
    expect(transitRoutingNote("bike", 5)).toContain("Rad");
  });

  it("formats arrival for API in Berlin timezone", () => {
    const date = new Date("2026-05-25T06:00:00.000Z");
    const formatted = formatTransitArrivalForApi(date);
    expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\+02:00$/);
  });

  it("finds next weekday occurrence in the future", () => {
    const mondayMorning = new Date("2026-05-25T06:00:00.000Z");
    const arrival = nextTransitArrivalDate(1, 8, 0, mondayMorning);
    expect(arrival.getTime()).toBeGreaterThan(mondayMorning.getTime());
  });
});

describe("transit routing helpers", () => {
  it("formats connection summary from legs", () => {
    expect(
      formatConnectionSummary([
        { walking: true, line: null },
        { walking: false, line: { name: "S 1" } },
        { walking: false, line: { name: "Bus 42" } },
      ])
    ).toBe("S 1 → Bus 42");
  });

  it("formats leg detail lines with stops and platforms", () => {
    const details = buildTransitLegDetails([
      {
        walking: true,
        origin: { name: "Wohnung" },
        destination: { name: "S+U Frankfurter Allee" },
        distance: 420,
      },
      {
        walking: false,
        line: { name: "U5" },
        origin: { name: "S+U Frankfurter Allee" },
        destination: { name: "Alexanderplatz" },
        plannedDeparture: "2026-05-26T07:32:00+02:00",
        plannedArrival: "2026-05-26T07:48:00+02:00",
        plannedDeparturePlatform: "2",
        plannedArrivalPlatform: "4",
      },
    ]);

    expect(formatTransitLegDetailLine(details[0], 0)).toContain("Fußweg");
    expect(formatTransitLegDetailLine(details[0], 0)).toContain("420 m");
    expect(formatTransitLegDetailLine(details[1], 1)).toContain("U5");
    expect(formatTransitLegDetailLine(details[1], 1)).toContain("Gleis 2");
    expect(formatTransitLegDetailLine(details[1], 1)).toContain("Alexanderplatz");

    const tooltip = formatTransitDetailTooltip(details);
    expect(tooltip.split("\n")).toHaveLength(2);
  });

  it("computes journey duration from leg timestamps", () => {
    const seconds = journeyDurationSeconds([
      {
        departure: "2026-05-26T07:00:00+02:00",
        arrival: "2026-05-26T07:15:00+02:00",
      },
      {
        departure: "2026-05-26T07:20:00+02:00",
        arrival: "2026-05-26T08:00:00+02:00",
      },
    ]);
    expect(seconds).toBe(60 * 60);
  });
});
