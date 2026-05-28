import { describe, expect, it } from "vitest";
import { projectMapPoisFromOverpassData } from "@/lib/project-map-pois";
import type { OverpassPoiData } from "@/lib/overpass-poi";

describe("project-map-pois", () => {
  it("builds map markers from overpass data", () => {
    const data: OverpassPoiData = {
      radii: { close: 500, wider: 1000 },
      categories: {
        supermarket: { countClose: 1, countWide: 1, nearest: null },
        pharmacy: { countClose: 0, countWide: 0, nearest: null },
        school: { countClose: 0, countWide: 0, nearest: null },
        kindergarten: { countClose: 0, countWide: 0, nearest: null },
        publicTransport: { countClose: 0, countWide: 0, nearest: null },
        park: { countClose: 0, countWide: 0, nearest: null },
        medical: { countClose: 0, countWide: 0, nearest: null },
      },
      markers: [
        {
          categoryId: "supermarket",
          name: "Testmarkt",
          distanceM: 120,
          lat: 53.1,
          lng: 8.89,
          osmType: "node",
          osmId: 1,
        },
      ],
    };

    const markers = projectMapPoisFromOverpassData("apt-1", "Horn", data);
    expect(markers).toHaveLength(1);
    expect(markers[0]?.apartmentTitle).toBe("Horn");
    expect(markers[0]?.name).toBe("Testmarkt");
  });
});
