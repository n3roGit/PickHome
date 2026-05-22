import { describe, expect, it } from "vitest";
import {
  isNotableDivergence as isNotable,
  partnerComparisons as partners,
} from "@/lib/rating-divergence";
import { apartmentScore, computeScore } from "@/lib/scoring";

const criteria = [
  { id: "heavy", weight: 5, isDealbreaker: true, name: "Must have" },
  { id: "light", weight: 3, isDealbreaker: false, name: "Nice" },
  { id: "extra", weight: 2, isDealbreaker: false, name: "Extra" },
];

const criteriaInputs = criteria.map(({ id, weight, isDealbreaker }) => ({
  id,
  weight,
  isDealbreaker,
}));

/**
 * Contract tests for apartment scoring — documents how criteria flow into totals.
 * See user-facing summary in project docs / agent responses (German UI, English code).
 */
describe("scoring contract: unrated vs zero vs partial", () => {
  it("unrated apartment: score 0 but rated 0 of total (not the same as scoring zero)", () => {
    expect(computeScore(criteriaInputs, [])).toEqual({
      score: 0,
      displayScore: 0,
      dealbreaker: false,
      rated: 0,
      total: 3,
    });
  });

  it("explicit null score is treated like unrated (skipped)", () => {
    const result = computeScore(criteriaInputs, [
      { criterionId: "heavy", score: null },
      { criterionId: "light", score: 8 },
    ]);
    expect(result.rated).toBe(1);
    expect(result.score).toBe(80);
    expect(result.total).toBe(3);
  });

  it("undefined missing map entry is treated like unrated", () => {
    const result = computeScore(criteriaInputs, [{ criterionId: "light", score: 6 }]);
    expect(result.rated).toBe(1);
    expect(result.total).toBe(3);
    expect(result.score).toBe(60);
  });

  it("score 0 on a criterion counts as rated and pulls the weighted average down", () => {
    const onlyZero = computeScore(criteriaInputs, [{ criterionId: "light", score: 0 }]);
    expect(onlyZero.rated).toBe(1);
    expect(onlyZero.score).toBe(0);
    expect(onlyZero.displayScore).toBe(0);
    expect(onlyZero.dealbreaker).toBe(false);

    const mixed = computeScore(criteriaInputs, [
      { criterionId: "heavy", score: 10 },
      { criterionId: "light", score: 0 },
    ]);
    // (5*1.0 + 3*0) / 8 * 100 = 62.5 -> 63
    expect(mixed.rated).toBe(2);
    expect(mixed.score).toBe(63);
  });

  it("dealbreaker score 0 triggers rejection (score 0, displayScore still computed)", () => {
    const result = computeScore(criteriaInputs, [{ criterionId: "heavy", score: 0 }]);
    expect(result.dealbreaker).toBe(true);
    expect(result.score).toBe(0);
    expect(result.displayScore).toBe(0);
    expect(result.rated).toBe(1);
  });

  it("partial ratings: denominator uses only rated criteria weights", () => {
    const oneHigh = computeScore(criteriaInputs, [{ criterionId: "extra", score: 10 }]);
    expect(oneHigh.score).toBe(100);
    expect(oneHigh.rated).toBe(1);
    expect(oneHigh.total).toBe(3);

    const twoMixed = computeScore(criteriaInputs, [
      { criterionId: "heavy", score: 6 },
      { criterionId: "extra", score: 10 },
    ]);
    // (5*0.6 + 2*1.0) / 7 * 100 ≈ 71
    expect(twoMixed.score).toBe(71);
    expect(twoMixed.rated).toBe(2);
  });
});

describe("scoring contract: multi-user isolation", () => {
  const ratings = [
    { criterionId: "heavy", userId: "alice", score: 10 },
    { criterionId: "light", userId: "alice", score: 10 },
    { criterionId: "heavy", userId: "bob", score: 2 },
    { criterionId: "light", userId: "bob", score: 10 },
    { criterionId: "heavy", userId: "carol", score: null as number | null },
    { criterionId: "light", userId: "carol", score: 8 },
  ];

  it("each member gets an independent total from their own ratings only", () => {
    const alice = apartmentScore(criteriaInputs, ratings, "alice");
    const bob = apartmentScore(criteriaInputs, ratings, "bob");
    const carol = apartmentScore(criteriaInputs, ratings, "carol");

    expect(alice.score).toBe(100);
    expect(alice.dealbreaker).toBe(false);
    expect(alice.rated).toBe(2);

    expect(bob.dealbreaker).toBe(true);
    expect(bob.score).toBe(0);
    expect(bob.displayScore).toBeGreaterThan(0);

    expect(carol.dealbreaker).toBe(false);
    expect(carol.rated).toBe(1);
    expect(carol.score).toBe(80);
    expect(carol.total).toBe(3);
  });

  it("partner with no ratings at all matches empty apartment contract", () => {
    const empty = apartmentScore(criteriaInputs, ratings, "nobody");
    expect(empty).toEqual({
      score: 0,
      displayScore: 0,
      dealbreaker: false,
      rated: 0,
      total: 3,
    });
  });
});

describe("scoring contract: partner divergence", () => {
  it("criterion delta only when both partners rated that criterion", () => {
    const comparisons = partners({
      criteria,
      ratings: [
        { apartmentId: "a1", userId: "u1", criterionId: "heavy", score: 8 },
        { apartmentId: "a1", userId: "u2", criterionId: "light", score: 4 },
      ],
      apartmentId: "a1",
      currentUserId: "u1",
      partners: [{ userId: "u2", name: "Partner" }],
      dealbreakerThreshold: 3,
    });
    expect(comparisons[0].topDivergentCriteria).toHaveLength(0);
  });

  it("notable divergence requires at least half of criteria rated by both", () => {
    const comparisons = partners({
      criteria,
      ratings: [
        { apartmentId: "a1", userId: "u1", criterionId: "heavy", score: 10 },
        { apartmentId: "a1", userId: "u2", criterionId: "heavy", score: 2 },
      ],
      apartmentId: "a1",
      currentUserId: "u1",
      partners: [{ userId: "u2", name: "Partner" }],
      dealbreakerThreshold: 3,
    });
    expect(isNotable(comparisons[0])).toBe(false);

    const full = partners({
      criteria,
      ratings: [
        { apartmentId: "a1", userId: "u1", criterionId: "heavy", score: 10 },
        { apartmentId: "a1", userId: "u1", criterionId: "light", score: 10 },
        { apartmentId: "a1", userId: "u2", criterionId: "heavy", score: 2 },
        { apartmentId: "a1", userId: "u2", criterionId: "light", score: 2 },
      ],
      apartmentId: "a1",
      currentUserId: "u1",
      partners: [{ userId: "u2", name: "Partner" }],
      dealbreakerThreshold: 3,
    });
    expect(isNotable(full[0])).toBe(true);
    expect(full[0].delta).toBeGreaterThanOrEqual(15);
  });
});
