import { describe, expect, it } from "vitest";
import { distanceMeters } from "@/lib/geo-coords";
import { formatPoiEnvironmentCompact, markersForMap } from "@/lib/overpass-poi";
import type { OverpassPoiData } from "@/lib/overpass-poi";

describe("overpass-poi", () => {
  it("computes haversine distance", () => {
    const d = distanceMeters(52.52, 13.405, 52.521, 13.41);
    expect(d).toBeGreaterThan(300);
    expect(d).toBeLessThan(800);
  });

  it("formats compact environment string", () => {
    const data: OverpassPoiData = {
      radii: { close: 500, wider: 1000 },
      categories: {
        supermarket: { countClose: 1, countWide: 2, nearest: null },
        pharmacy: { countClose: 0, countWide: 0, nearest: null },
        school: { countClose: 0, countWide: 0, nearest: null },
        kindergarten: { countClose: 0, countWide: 0, nearest: null },
        publicTransport: { countClose: 0, countWide: 3, nearest: null },
        park: { countClose: 0, countWide: 0, nearest: null },
        medical: { countClose: 0, countWide: 0, nearest: null },
      },
    };
    expect(formatPoiEnvironmentCompact(data)).toContain("Supermarkt");
    expect(formatPoiEnvironmentCompact(data)).toContain("ÖPNV");
  });

  it("falls back to nearest POIs per category when markers missing", () => {
    const data: OverpassPoiData = {
      radii: { close: 500, wider: 1000 },
      categories: {
        supermarket: {
          countClose: 1,
          countWide: 1,
          nearest: {
            name: "Shop",
            distanceM: 100,
            lat: 52.52,
            lng: 13.4,
            osmType: "node",
            osmId: 1,
          },
        },
        pharmacy: { countClose: 0, countWide: 0, nearest: null },
        school: { countClose: 0, countWide: 0, nearest: null },
        kindergarten: { countClose: 0, countWide: 0, nearest: null },
        publicTransport: { countClose: 0, countWide: 0, nearest: null },
        park: { countClose: 0, countWide: 0, nearest: null },
        medical: { countClose: 0, countWide: 0, nearest: null },
      },
    };
    expect(markersForMap(data)).toHaveLength(1);
    expect(markersForMap({ ...data, markers: [{ categoryId: "pharmacy", ...data.categories.supermarket.nearest!, name: "A" }] })).toHaveLength(1);
  });
});
