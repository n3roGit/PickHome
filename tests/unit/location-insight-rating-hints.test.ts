import { describe, expect, it } from "vitest";
import { buildNoiseHintsByCriterionId } from "@/lib/location-insight-rating-hints";
import type { NoiseHit } from "@/lib/noise-uba";

describe("location-insight-rating-hints", () => {
  it("builds hints for matching criteria", () => {
    const hits: NoiseHit[] = [
      {
        source: "Straße",
        metric: "Lden",
        bandDb: "65-70",
        layerName: "road",
      },
    ];
    const hints = buildNoiseHintsByCriterionId(
      [{ id: "c1", name: "Straßenlärm" }],
      hits
    );
    expect(hints.c1).toContain("UBA");
    expect(hints.c1).toContain("Straße");
  });
});
