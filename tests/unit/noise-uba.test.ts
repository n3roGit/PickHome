import { describe, expect, it } from "vitest";
import {
  highestNoiseBandDb,
  noiseHitsForCriterionName,
  parseNoiseIdentifyResults,
} from "@/lib/noise-uba";

describe("noise-uba", () => {
  it("parses identify hits with source classification", () => {
    const hits = parseNoiseIdentifyResults([
      {
        layerName: "Straßenverkehrslärm Lden",
        attributes: { Lden: "65-70" },
      },
      {
        layerName: "Haupteisenbahn Lnight",
        attributes: { Lnight: ">70" },
      },
    ]);

    expect(hits).toHaveLength(2);
    expect(hits[0].source).toBe("Straße");
    expect(hits[0].bandDb).toBe("65-70");
    expect(hits[1].source).toBe("Schiene");
    expect(highestNoiseBandDb(hits)).toBe(70);
  });

  it("maps hits to criterion names", () => {
    const hits = parseNoiseIdentifyResults([
      { layerName: "Flughafen Lden", attributes: { Lden: "60" } },
    ]);
    expect(noiseHitsForCriterionName(hits, "Fluglärm")).toHaveLength(1);
    expect(noiseHitsForCriterionName(hits, "Zuglärm")).toHaveLength(0);
  });
});
