import { describe, expect, it } from "vitest";
import {
  buildGoogleMapsStreetViewUrl,
  hasGoogleMapsStreetViewCoords,
} from "@/lib/google-maps-links";

describe("buildGoogleMapsStreetViewUrl", () => {
  it("builds pano URL from coordinates", () => {
    const url = buildGoogleMapsStreetViewUrl({
      latitude: 53.0936552,
      longitude: 8.8640261,
    });
    expect(url).toBe(
      "https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=53.0936552%2C8.8640261"
    );
  });

  it("falls back to address search when coords missing", () => {
    const url = buildGoogleMapsStreetViewUrl({ address: "Exampleweg 1, 12345 Teststadt" });
    expect(url).toBe(
      "https://www.google.com/maps/search/?api=1&query=Exampleweg+1%2C+12345+Teststadt"
    );
  });

  it("returns null when nothing usable", () => {
    expect(buildGoogleMapsStreetViewUrl({})).toBeNull();
    expect(buildGoogleMapsStreetViewUrl({ address: "   " })).toBeNull();
  });
});

describe("hasGoogleMapsStreetViewCoords", () => {
  it("detects finite coordinates", () => {
    expect(hasGoogleMapsStreetViewCoords(1, 2)).toBe(true);
    expect(hasGoogleMapsStreetViewCoords(null, 2)).toBe(false);
    expect(hasGoogleMapsStreetViewCoords(Number.NaN, 2)).toBe(false);
  });
});
