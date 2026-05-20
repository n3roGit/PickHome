import { describe, expect, it } from "vitest";
import {
  isNotableDivergence,
  maxNotableDivergence,
  partnerComparisons,
} from "@/lib/rating-divergence";

describe("rating-divergence", () => {
  const criteria = [
    { id: "c1", name: "Lage", weight: 4, isDealbreaker: false },
    { id: "c2", name: "Preis", weight: 3, isDealbreaker: true },
  ];

  it("computes score delta and top divergent criteria", () => {
    const comparisons = partnerComparisons({
      criteria,
      ratings: [
        { apartmentId: "a1", userId: "u1", criterionId: "c1", score: 8 },
        { apartmentId: "a1", userId: "u1", criterionId: "c2", score: 9 },
        { apartmentId: "a1", userId: "u2", criterionId: "c1", score: 3 },
        { apartmentId: "a1", userId: "u2", criterionId: "c2", score: 4 },
      ],
      apartmentId: "a1",
      currentUserId: "u1",
      partners: [{ userId: "u2", name: "Partner" }],
      dealbreakerThreshold: 3,
    });

    expect(comparisons).toHaveLength(1);
    expect(comparisons[0].delta).toBeGreaterThan(0);
    expect(comparisons[0].topDivergentCriteria[0].name).toBe("Lage");
    expect(comparisons[0].topDivergentCriteria[0].delta).toBe(5);
  });

  it("flags notable divergence when rated enough", () => {
    const comparisons = partnerComparisons({
      criteria,
      ratings: [
        { apartmentId: "a1", userId: "u1", criterionId: "c1", score: 10 },
        { apartmentId: "a1", userId: "u1", criterionId: "c2", score: 10 },
        { apartmentId: "a1", userId: "u2", criterionId: "c1", score: 2 },
        { apartmentId: "a1", userId: "u2", criterionId: "c2", score: 2 },
      ],
      apartmentId: "a1",
      currentUserId: "u1",
      partners: [{ userId: "u2", name: "Partner" }],
      dealbreakerThreshold: 3,
    });

    expect(isNotableDivergence(comparisons[0])).toBe(true);
    expect(maxNotableDivergence(comparisons)?.partnerName).toBe("Partner");
  });
});
