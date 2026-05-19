import { describe, expect, it } from "vitest";
import { apartmentScore, flattenCriteria } from "@/lib/project-data";

describe("project-data helpers", () => {
  const criteria = [
    { id: "c1", weight: 4, isDealbreaker: false },
    { id: "c2", weight: 2, isDealbreaker: true },
  ];

  it("flattens grouped criteria", () => {
    expect(
      flattenCriteria([
        { criteria: [criteria[0]] },
        { criteria: [criteria[1]] },
      ])
    ).toEqual(criteria);
  });

  it("scores only the given user's ratings", () => {
    const result = apartmentScore(
      criteria,
      [
        { criterionId: "c1", userId: "u1", score: 10 },
        { criterionId: "c2", userId: "u1", score: 10 },
        { criterionId: "c1", userId: "u2", score: 0 },
      ],
      "u1"
    );
    expect(result.score).toBe(100);
    expect(result.dealbreaker).toBe(false);
  });
});
