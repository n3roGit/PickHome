import { describe, expect, it } from "vitest";
import { computeClimateNormalsFromDaily } from "@/lib/climate-open-meteo";
import { parseOverpassMicroElements } from "@/lib/overpass-micro";
import {
  buildRadonAssessment,
  parseRadonWfsFeatures,
} from "@/lib/radon-bfs";
import { buildLocationInsightLlmBlocks } from "@/lib/location-insight-export";
import type { ApartmentLocationInsightsBundle } from "@/lib/location-insights";

describe("radon-bfs", () => {
  it("parses indoor radon from WFS features", () => {
    const data = parseRadonWfsFeatures({
      indoorFeatures: {
        features: [{ properties: { GEN: "Berlin", BEZ: "Stadt", AM: 31 } }],
      },
      soilFeatures: { features: [{ properties: { grp_pb_: 15.9 } }] },
      precautionFeatures: { features: [] },
    });
    expect(data.indoorRadonBqPerM3).toBe(31);
    expect(data.municipalityName).toBe("Berlin");
    expect(data.headline).toContain("31");
  });

  it("flags precaution areas", () => {
    const { headline } = buildRadonAssessment(null, null, true);
    expect(headline).toContain("Vorsorgegebiet");
  });
});

describe("climate-open-meteo", () => {
  it("computes annual climate summaries", () => {
    const data = computeClimateNormalsFromDaily({
      daily: {
        time: ["1991-01-01", "1991-01-02", "1991-07-01"],
        temperature_2m_max: [2, 4, 24],
        precipitation_sum: [0, 5, 1],
      },
    });
    expect(data.meanAnnualMaxTempC).not.toBeNull();
    expect(data.meanSummerMaxTempC).toBe(24);
    expect(data.headline).toContain("°C");
  });
});

describe("overpass-micro", () => {
  it("summarizes building heritage and nearby industry", () => {
    const data = parseOverpassMicroElements(
      [
        {
          type: "way",
          id: 1,
          center: { lat: 52.5171, lon: 13.3881 },
          tags: {
            building: "apartments",
            start_date: "1912",
            heritage: "4",
            "lda:criteria": "Baudenkmal",
          },
        },
        {
          type: "way",
          id: 2,
          center: { lat: 52.5162, lon: 13.3892 },
          tags: { landuse: "commercial", name: "Gewerbepark" },
        },
      ],
      52.517,
      13.388
    );
    expect(data.building?.detail).toContain("Denkmal");
    expect(data.industrial.count).toBe(1);
    expect(data.industrialHeadline).toContain("Gewerbepark");
  });
});

describe("location-insight-export new domains", () => {
  it("includes radon, micro and climate in LLM blocks", () => {
    const fresh = new Date();
    const bundle = {
      overpass: { domain: "overpass", status: "no_data", errorMessage: null, fetchedAt: fresh, data: null },
      noise: { domain: "noise", status: "no_data", errorMessage: null, fetchedAt: fresh, data: null },
      flood: { domain: "flood", status: "no_data", errorMessage: null, fetchedAt: fresh, data: null },
      air: { domain: "air", status: "no_data", errorMessage: null, fetchedAt: fresh, data: null },
      radon: {
        domain: "radon",
        status: "ok",
        errorMessage: null,
        fetchedAt: fresh,
        data: {
          municipalityName: "Berlin",
          municipalityType: "Stadt",
          indoorRadonBqPerM3: 31,
          soilPotentialPercent: 15.9,
          precautionAreas: [],
          headline: "Gemeinde-Durchschnitt 31 Bq/m³",
          assessment: "Prognose",
        },
      },
      micro: {
        domain: "micro",
        status: "ok",
        errorMessage: null,
        fetchedAt: fresh,
        data: {
          building: null,
          industrial: { count: 1, nearest: null },
          majorRoad: { count: 0, nearest: null },
          railway: { count: 1, nearest: null },
          nightlife: { count: 0, nearest: null },
          buildingHeadline: "Kein Gebäude",
          industrialHeadline: "1 Gewerbe",
          transportHeadline: "Schiene nah",
          nightlifeHeadline: "Keine Bars",
        },
      },
      climate: {
        domain: "climate",
        status: "ok",
        errorMessage: null,
        fetchedAt: fresh,
        data: {
          periodLabel: "1991–2020",
          meanAnnualMaxTempC: 14.2,
          meanSummerMaxTempC: 24.1,
          meanWinterMaxTempC: 3.2,
          meanAnnualPrecipitationMm: 570,
          meanRainyDaysPerYear: 110,
          headline: "Ø Tageshöchstwert 14.2 °C",
          assessment: "Modellwerte",
        },
      },
    } satisfies ApartmentLocationInsightsBundle;

    const blocks = buildLocationInsightLlmBlocks(bundle);
    const text = blocks.join("\n");
    expect(text).toContain("Radon");
    expect(text).toContain("Mikrolage");
    expect(text).toContain("Klima");
  });
});
