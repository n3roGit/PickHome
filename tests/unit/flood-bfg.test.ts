import { describe, expect, it } from "vitest";
import { parseFloodIdentifyResults, worstFloodScenario } from "@/lib/flood-bfg";

describe("flood-bfg", () => {
  it("marks scenarios as affected from layer names", () => {
    const data = parseFloodIdentifyResults([
      {
        layerName: "NZ.RiskZone_100",
        attributes: { name: "HQ100 zone" },
      },
    ]);

    expect(data.scenarios.HQ100).toBe("betroffen");
    expect(data.scenarios.HQhaeufig).toBe("nicht_betroffen");
    expect(worstFloodScenario(data)).toBe("HQ100");
  });
});
