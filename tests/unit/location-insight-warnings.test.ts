import { describe, expect, it } from "vitest";
import type { FloodBfgData } from "@/lib/flood-bfg";
import {
  locationInsightWarnings,
  type ApartmentLocationInsightsBundle,
} from "@/lib/location-insights";

function bundleWithFlood(data: FloodBfgData | null): ApartmentLocationInsightsBundle {
  const pending = {
    domain: "overpass" as const,
    status: "pending" as const,
    errorMessage: null,
    fetchedAt: new Date(0),
    data: null,
  };
  return {
    overpass: { ...pending, domain: "overpass" },
    noise: { ...pending, domain: "noise" },
    flood: {
      domain: "flood",
      status: data ? "ok" : "no_data",
      errorMessage: null,
      fetchedAt: new Date(),
      data,
    },
    air: { ...pending, domain: "air" },
    radon: { ...pending, domain: "radon" },
    micro: { ...pending, domain: "micro" },
    climate: { ...pending, domain: "climate" },
  };
}

describe("locationInsightWarnings flood", () => {
  it("warns for HQhaeufig and HQ100 but not HQextrem-only", () => {
    const onlyExtrem: FloodBfgData = {
      scenarios: {
        HQhaeufig: "nicht_betroffen",
        HQ100: "nicht_betroffen",
        HQextrem: "betroffen",
      },
      detailLines: [],
    };
    expect(locationInsightWarnings(bundleWithFlood(onlyExtrem))).toEqual([]);

    const hq100: FloodBfgData = {
      ...onlyExtrem,
      scenarios: { ...onlyExtrem.scenarios, HQ100: "betroffen" },
    };
    expect(locationInsightWarnings(bundleWithFlood(hq100))).toEqual([
      { kind: "flood_hq100", label: "Hochwasser HQ100" },
    ]);

    const hqhaeufig: FloodBfgData = {
      scenarios: {
        HQhaeufig: "betroffen",
        HQ100: "betroffen",
        HQextrem: "betroffen",
      },
      detailLines: [],
    };
    expect(locationInsightWarnings(bundleWithFlood(hqhaeufig))).toEqual([
      { kind: "flood_hqhaeufig", label: "Hochwasser häufig" },
    ]);
  });
});
