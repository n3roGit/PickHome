import { describe, expect, it } from "vitest";
import {
  assessAirIndexValue,
  buildAirQualityHeadline,
  findNearestAirStation,
  parseLatestHourMeasurements,
  parseUbaComponentMeta,
  parseUbaStations,
} from "@/lib/air-quality-uba";

describe("air-quality-uba", () => {
  it("parses station rows and finds nearest", () => {
    const stations = parseUbaStations({
      indices: [],
      data: {
        "1": [
          "100",
          "DEBB001",
          "Far Station",
          "Far City",
          "",
          "2020-01-01",
          null,
          "10",
          "51",
        ],
        "2": [
          "200",
          "DEBE125",
          "Berlin Station",
          "Berlin",
          "",
          "2020-01-01",
          null,
          "13.38",
          "52.51",
        ],
      },
    });
    const nearest = findNearestAirStation(stations, 52.5156, 13.3801);
    expect(nearest?.station.code).toBe("DEBE125");
    expect(nearest?.distanceM).toBeLessThan(5000);
  });

  it("parses latest hour measurements", () => {
    const components = parseUbaComponentMeta({
      indices: [],
      "1": ["1", "PM10", "PM₁₀", "µg/m³", "Dust"],
      "5": ["5", "NO2", "NO₂", "µg/m³", "Nitrogen dioxide"],
      "9": ["9", "PM2", "PM₂,₅", "µg/m³", "Fine dust"],
    });
    const parsed = parseLatestHourMeasurements(
      {
        "2026-05-28 14:00:00": [
          "2026-05-28 15:00:00",
          1,
          1,
          [1, 20, 1, "1.588"],
          [5, 17, 1, "1.316"],
          [9, 10, 1, "1.333"],
        ],
      },
      components
    );
    expect(parsed?.measurements).toHaveLength(3);
    expect(parsed?.measurements[0]?.code).toBe("PM10");
    expect(assessAirIndexValue(1.588)).toBe("gut");
    expect(buildAirQualityHeadline(parsed!.measurements)).toContain("PM₂,₅");
  });
});
