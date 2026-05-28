import { describe, expect, it } from "vitest";
import {
  needsLocationInsightBackfill,
  type ApartmentLocationInsightsBundle,
} from "@/lib/location-insights";
import type { LocationInsightSnapshot } from "@/lib/location-insight-cache";
import { LOCATION_INSIGHT_CACHE_TTL_MS } from "@/lib/location-insight-cache";

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
  return {
    overpass: snapshot("overpass", "ok", fresh),
    noise: { ...snapshot("overpass", "ok", fresh), domain: "noise" },
    flood: { ...snapshot("overpass", "ok", fresh), domain: "flood" },
    air: { ...snapshot("overpass", "ok", fresh), domain: "air" },
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
});
