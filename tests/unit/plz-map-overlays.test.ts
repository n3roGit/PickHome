import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_PLZ_OVERLAY_RADIUS_M,
  mergeOverlappingPlzOverlays,
  resolvePlzMapOverlays,
} from "@/lib/plz-map-overlays";

vi.mock("@/lib/geocode", () => ({
  geocodeAddress: vi.fn(async () => null),
}));

vi.mock("@/lib/plz-reference", () => ({
  plzCentroid: vi.fn(() => null),
}));

describe("plz-map-overlays", () => {
  it("uses apartment coordinates averaged per PLZ", async () => {
    const overlays = await resolvePlzMapOverlays(
      ["28203", "28209"],
      [
        {
          address: "Weg 1, 28203 Bremen",
          latitude: 53.08,
          longitude: 8.81,
        },
        {
          address: "Weg 2, 28203 Bremen",
          latitude: 53.1,
          longitude: 8.83,
        },
      ]
    );

    expect(overlays).toHaveLength(1);
    expect(overlays[0].plz).toBe("28203");
    expect(overlays[0].lat).toBeCloseTo(53.09, 2);
    expect(overlays[0].lng).toBeCloseTo(8.82, 2);
  });

  it("merges strongly overlapping circles into one larger circle", () => {
    const merged = mergeOverlappingPlzOverlays([
      { plz: "28201", lat: 53.075, lng: 8.807 },
      { plz: "28203", lat: 53.078, lng: 8.825 },
      { plz: "28205", lat: 53.069, lng: 8.845 },
    ]);

    expect(merged).toHaveLength(1);
    expect(merged[0].plzList).toEqual(["28201", "28203", "28205"]);
    expect(merged[0].radiusM).toBeGreaterThan(DEFAULT_PLZ_OVERLAY_RADIUS_M);
  });

  it("keeps separate circles when they do not overlap strongly", () => {
    const merged = mergeOverlappingPlzOverlays([
      { plz: "28279", lat: 53.03, lng: 8.85 },
      { plz: "28329", lat: 53.08, lng: 8.92 },
    ]);

    expect(merged).toHaveLength(2);
    expect(merged.every((entry) => entry.radiusM === DEFAULT_PLZ_OVERLAY_RADIUS_M)).toBe(true);
  });

  it("skips geocoding when geocode option is false", async () => {
    const { geocodeAddress } = await import("@/lib/geocode");
    vi.mocked(geocodeAddress).mockClear();
    const overlays = await resolvePlzMapOverlays(["28203"], [], { geocode: false });
    expect(overlays).toHaveLength(0);
    expect(geocodeAddress).not.toHaveBeenCalled();
  });

  it("applies custom radius when merge option is false", async () => {
    const overlays = await resolvePlzMapOverlays(
      ["28203"],
      [
        {
          address: "Weg 1, 28203 Bremen",
          latitude: 53.08,
          longitude: 8.81,
        },
      ],
      { geocode: false, merge: false, radiusM: 4000 }
    );

    expect(overlays).toHaveLength(1);
    expect(overlays[0].radiusM).toBe(4000);
  });

  it("keeps separate circles when merge option is false", async () => {
    const { geocodeAddress } = await import("@/lib/geocode");
    vi.mocked(geocodeAddress).mockClear();
    vi.mocked(geocodeAddress).mockImplementation(async (address: string) => {
      if (address.startsWith("28203"))
        return { latitude: 53.078, longitude: 8.825, district: null, displayName: null };
      if (address.startsWith("28209"))
        return { latitude: 53.067, longitude: 8.845, district: null, displayName: null };
      return null;
    });

    const overlays = await resolvePlzMapOverlays(["28203", "28209"], [], {
      geocode: true,
      merge: false,
    });

    expect(overlays).toHaveLength(2);
    expect(overlays.map((entry) => entry.plz)).toEqual(["28203", "28209"]);
  });
});
