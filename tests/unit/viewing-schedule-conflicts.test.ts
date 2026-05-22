import { describe, expect, it } from "vitest";
import {
  VIEWING_DURATION_MINUTES,
  buildViewingScheduleWarnings,
  estimateDrivingMinutes,
} from "@/lib/viewing-schedule-conflicts";

const TZ = "Europe/Berlin";

function slot(
  id: string,
  title: string,
  at: string,
  coords?: { latitude: number; longitude: number }
) {
  return {
    id,
    apartmentId: id,
    apartmentTitle: title,
    scheduledAt: new Date(at),
    latitude: coords?.latitude ?? null,
    longitude: coords?.longitude ?? null,
    address: coords ? "Test" : null,
  };
}

describe("buildViewingScheduleWarnings", () => {
  it("warns when gap is smaller than travel plus buffer", () => {
    const a = slot("a", "Haus A", "2026-06-15T10:00:00", { latitude: 52.52, longitude: 13.4 });
    const b = slot("b", "Haus B", "2026-06-15T11:15:00", { latitude: 52.48, longitude: 13.38 });
    const map = buildViewingScheduleWarnings([a, b], TZ, () => 30, {
      onlyUpcoming: false,
    });
    expect(map.get("b")?.some((w) => w.kind === "tight_after")).toBe(true);
    expect(map.get("a")?.some((w) => w.kind === "tight_before")).toBe(true);
  });

  it("does not warn when enough time after one hour viewing", () => {
    const a = slot("a", "Haus A", "2026-06-15T10:00:00", { latitude: 52.52, longitude: 13.4 });
    const b = slot("b", "Haus B", "2026-06-15T12:30:00", { latitude: 52.48, longitude: 13.38 });
    const map = buildViewingScheduleWarnings([a, b], TZ, () => 20, {
      onlyUpcoming: false,
    });
    expect(map.get("b")).toBeUndefined();
  });

  it("warns on overlap", () => {
    const a = slot("a", "A", "2026-06-15T10:00:00");
    const b = slot("b", "B", "2026-06-15T10:30:00");
    const map = buildViewingScheduleWarnings([a, b], TZ, () => null, {
      onlyUpcoming: false,
    });
    expect(map.get("b")?.some((w) => w.kind === "overlap_after")).toBe(true);
  });

  it("ignores viewings on different days", () => {
    const a = slot("a", "A", "2026-06-15T10:00:00");
    const b = slot("b", "B", "2026-06-16T10:30:00");
    const map = buildViewingScheduleWarnings([a, b], TZ, () => 5, {
      onlyUpcoming: false,
    });
    expect(map.size).toBe(0);
  });
});

describe("estimateDrivingMinutes", () => {
  it("returns at least 5 minutes", () => {
    expect(
      estimateDrivingMinutes(
        { latitude: 52.52, longitude: 13.4 },
        { latitude: 52.521, longitude: 13.401 }
      )
    ).toBeGreaterThanOrEqual(5);
  });
});

describe("VIEWING_DURATION_MINUTES", () => {
  it("is one hour", () => {
    expect(VIEWING_DURATION_MINUTES).toBe(60);
  });
});
