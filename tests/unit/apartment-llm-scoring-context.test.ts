import { describe, expect, it } from "vitest";
import { buildApartmentScoringLlmSection } from "@/lib/apartment-llm-context";

describe("buildApartmentScoringLlmSection", () => {
  it("includes weights, dealbreaker flag, and member ratings", () => {
    const section = buildApartmentScoringLlmSection({
      dealbreakerThreshold: 3,
      focusUserId: "u1",
      members: [
        { userId: "u1", name: "Alex" },
        { userId: "u2", name: "Sam" },
      ],
      groups: [
        {
          name: "Lage",
          criteria: [
            { id: "c1", name: "ÖPNV", weight: 5, isDealbreaker: true },
            { id: "c2", name: "Grün", weight: 2, isDealbreaker: false },
          ],
        },
      ],
      ratings: [
        { criterionId: "c1", userId: "u1", score: 8, note: "S-Bahn nah" },
        { criterionId: "c1", userId: "u2", score: 2 },
        { criterionId: "c2", userId: "u1", score: 6 },
      ],
    });

    expect(section).toContain("Bewertungskriterien (PickHome)");
    expect(section).toContain("Gewicht 5");
    expect(section).toContain("Dealbreaker ja");
    expect(section).toContain("Alex: 8/10 (Notiz: S-Bahn nah)");
    expect(section).toContain("Sam: 2/10");
    expect(section).toContain("Gesamtscore Alex:");
    expect(section).toContain("Gesamtscore Sam:");
    expect(section).toContain("primär auf die Bewertungen von Alex");
  });

  it("returns empty string when no criteria exist", () => {
    expect(
      buildApartmentScoringLlmSection({
        dealbreakerThreshold: 3,
        focusUserId: "u1",
        members: [{ userId: "u1", name: "Alex" }],
        groups: [],
        ratings: [],
      })
    ).toBe("");
  });
});
