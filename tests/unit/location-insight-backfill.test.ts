import { describe, expect, it } from "vitest";
import {
  needsLocationInsightBackfill,
  type ApartmentLocationInsightsBundle,
} from "@/lib/location-insights";
import type { LocationInsightSnapshot } from "@/lib/location-insight-cache";
import { LOCATION_INSIGHT_CACHE_TTL_MS } from "@/lib/location-insight-cache";
import { LOCATION_INSIGHT_ERROR_RETRY_AFTER_MS } from "@/lib/location-insight-retry";

function snapshot(
  domain: "overpass",
  status: LocationInsightSnapshot<null>["status"],
  fetchedAt: Date
): LocationInsightSnapshot<null> {
  return {
    domain,
    status,
    errorMessage: null,
    fetchedAt,
    data: null,
  };
}

function emptyBundle(
  overrides: Partial<ApartmentLocationInsightsBundle> = {}
): ApartmentLocationInsightsBundle {
  const fresh = new Date();
  const overpassWithMicro = {
    ...snapshot("overpass", "ok", fresh),
    data: {
      radii: { close: 500, wider: 1000 },
      categories: {} as never,
      micro: {
        building: null,
        industrial: { count: 0, nearest: null },
        majorRoad: { count: 0, nearest: null },
        railway: { count: 0, nearest: null },
        nightlife: { count: 0, nearest: null },
        buildingHeadline: "Kein Gebäude",
        industrialHeadline: "Keine Gewerbe",
        transportHeadline: "Keine Trasse",
        nightlifeHeadline: "Keine Bars",
      },
    },
  };
  return {
    overpass: overpassWithMicro,
    noise: { ...snapshot("overpass", "ok", fresh), domain: "noise" },
    flood: { ...snapshot("overpass", "ok", fresh), domain: "flood" },
    air: { ...snapshot("overpass", "ok", fresh), domain: "air" },
    radon: { ...snapshot("overpass", "ok", fresh), domain: "radon" },
    micro: { ...snapshot("overpass", "ok", fresh), domain: "micro" },
    climate: { ...snapshot("overpass", "ok", fresh), domain: "climate" },
    ...overrides,
  };
}

describe("needsLocationInsightBackfill", () => {
  it("returns true when any domain is pending", () => {
    const bundle = emptyBundle({
      air: { ...snapshot("overpass", "pending", new Date(0)), domain: "air" },
    });
    expect(needsLocationInsightBackfill(bundle)).toBe(true);
  });

  it("returns true when cached data is stale", () => {
    const stale = new Date(Date.now() - LOCATION_INSIGHT_CACHE_TTL_MS - 1000);
    const bundle = emptyBundle({
      noise: { ...snapshot("overpass", "ok", stale), domain: "noise", status: "ok" },
    });
    expect(needsLocationInsightBackfill(bundle)).toBe(true);
  });

  it("returns false when all domains are fresh", () => {
    expect(needsLocationInsightBackfill(emptyBundle())).toBe(false);
  });

  it("ignores no_coords domains", () => {
    const bundle = emptyBundle({
      overpass: { ...snapshot("overpass", "no_coords", new Date()), domain: "overpass" },
      noise: { ...snapshot("overpass", "ok", new Date()), domain: "noise" },
      flood: { ...snapshot("overpass", "ok", new Date()), domain: "flood" },
      air: { ...snapshot("overpass", "ok", new Date()), domain: "air" },
    });
    expect(needsLocationInsightBackfill(bundle)).toBe(false);
  });

  it("returns true when a retryable error is due for retry", () => {
    const fetchedAt = new Date(
      Date.now() - LOCATION_INSIGHT_ERROR_RETRY_AFTER_MS - 60_000
    );
    const bundle = emptyBundle({
      noise: {
        ...snapshot("overpass", "error", fetchedAt),
        domain: "noise",
        errorMessage: "fetch_failed",
      },
    });
    expect(needsLocationInsightBackfill(bundle)).toBe(true);
  });

  it("returns false for fresh retryable errors before backoff", () => {
    const bundle = emptyBundle({
      noise: {
        ...snapshot("overpass", "error", new Date()),
        domain: "noise",
        errorMessage: "fetch_failed",
      },
    });
    expect(needsLocationInsightBackfill(bundle)).toBe(false);
  });

  it("returns false for non-retryable errors", () => {
    const bundle = emptyBundle({
      noise: {
        ...snapshot("overpass", "error", new Date()),
        domain: "noise",
        errorMessage: "invalid_coords",
      },
    });
    expect(needsLocationInsightBackfill(bundle)).toBe(false);
  });
});
