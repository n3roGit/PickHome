import { describe, expect, it } from "vitest";
import {
  buildNoiseHumanSummary,
  highestNoiseBandDb,
  noiseHitsForCriterionName,
  parseNoiseIdentifyResults,
  parseUbaNoiseCode,
} from "@/lib/noise-uba";

describe("noise-uba", () => {
  it("parses UBA noise codes", () => {
    expect(parseUbaNoiseCode("Lden6064")).toEqual({ metric: "Lden", bandDb: "60-64" });
    expect(parseUbaNoiseCode("Lnight5054")).toEqual({ metric: "Lnight", bandDb: "50-54" });
    expect(parseUbaNoiseCode("Lden75")).toEqual({ metric: "Lden", bandDb: ">75" });
  });

  it("parses Berlin-style identify hits and dedupes by source", () => {
    const hits = parseNoiseIdentifyResults([
      {
        layerName: "LK_BLR_Abfrage",
        attributes: {
          road_den: "Lden6064",
          road_night: "Lnight5054",
          rail_den: "",
          rail_night: "",
        },
      },
      {
        layerName: "LK_HLQ_road_Den",
        attributes: { Lärmpegelklasse: "Lden5559" },
      },
      {
        layerName: "Bundeslaender_BZ",
        attributes: { Lden6064: "58800" },
      },
    ]);

    expect(hits.some((h) => h.source === "Straße" && h.metric === "Lden" && h.bandDb === "60-64")).toBe(
      true
    );
    expect(hits.some((h) => h.source === "Straße" && h.metric === "Lnight")).toBe(true);
    expect(hits.every((h) => !h.bandDb.includes("LK_"))).toBe(true);
    expect(highestNoiseBandDb(hits)).toBe(60);
  });

  it("builds human-readable summary", () => {
    const hits = parseNoiseIdentifyResults([
      {
        layerName: "LK_BLR_Abfrage",
        attributes: { road_den: "Lden6064", road_night: "Lnight5054" },
      },
    ]);
    const summary = buildNoiseHumanSummary(hits);
    expect(summary.headline).toMatch(/UBA-Lärmkarte/);
    expect(summary.sources[0]?.sourceLabel).toBe("Straßenverkehr");
    expect(summary.sources[0]?.lines[0]?.bandHuman).toContain("60");
  });

  it("maps hits to criterion names", () => {
    const hits = parseNoiseIdentifyResults([
      {
        layerName: "LK_BLR_Abfrage",
        attributes: { air_den: "Lden6064" },
      },
    ]);
    expect(noiseHitsForCriterionName(hits, "Fluglärm")).toHaveLength(1);
    expect(noiseHitsForCriterionName(hits, "Zuglärm")).toHaveLength(0);
  });
});
