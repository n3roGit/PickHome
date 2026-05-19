import { describe, expect, it } from "vitest";
import { apartmentScore } from "@/lib/project-data";
import { computeScore } from "@/lib/scoring";

const criteria = [
  { id: "c1", weight: 5, isDealbreaker: false },
  { id: "c2", weight: 3, isDealbreaker: true },
];

function ratingsFor(
  entries: { userId: string; criterionId: string; score: number }[]
) {
  return entries.map((e) => ({
    userId: e.userId,
    criterionId: e.criterionId,
    score: e.score,
  }));
}

describe("apartmentScore per user", () => {
  it("computes independent scores for two reviewers", () => {
    const all = ratingsFor([
      { userId: "christoph", criterionId: "c1", score: 10 },
      { userId: "christoph", criterionId: "c2", score: 10 },
      { userId: "jasmin", criterionId: "c1", score: 4 },
      { userId: "jasmin", criterionId: "c2", score: 8 },
    ]);

    const christoph = apartmentScore(criteria, all, "christoph");
    const jasmin = apartmentScore(criteria, all, "jasmin");

    expect(christoph.score).toBe(100);
    expect(christoph.dealbreaker).toBe(false);
    // (5*0.4 + 3*0.8) / 8 * 100 = 55
    expect(jasmin.score).toBe(55);
    expect(jasmin.dealbreaker).toBe(false);
  });

  it("partner dealbreaker does not affect my score", () => {
    const all = ratingsFor([
      { userId: "u1", criterionId: "c1", score: 10 },
      { userId: "u1", criterionId: "c2", score: 10 },
      { userId: "u2", criterionId: "c1", score: 10 },
      { userId: "u2", criterionId: "c2", score: 1 },
    ]);

    expect(apartmentScore(criteria, all, "u1").score).toBe(100);
    expect(apartmentScore(criteria, all, "u2").score).toBe(0);
    expect(apartmentScore(criteria, all, "u2").dealbreaker).toBe(true);
  });

  it("ignores other users when only one criterion is rated", () => {
    const all = ratingsFor([
      { userId: "u1", criterionId: "c1", score: 8 },
      { userId: "u2", criterionId: "c1", score: 0 },
      { userId: "u2", criterionId: "c2", score: 0 },
    ]);

    const u1 = apartmentScore(criteria, all, "u1");
    expect(u1.score).toBe(80);
    expect(u1.rated).toBe(1);
    expect(u1.total).toBe(2);
    expect(apartmentScore(criteria, all, "u2").dealbreaker).toBe(true);
  });
});

describe("compare-style scenarios", () => {
  it("same apartment can show high score for one member and zero for another", () => {
    const all = ratingsFor([
      { userId: "a", criterionId: "c1", score: 9 },
      { userId: "a", criterionId: "c2", score: 9 },
      { userId: "b", criterionId: "c1", score: 9 },
      { userId: "b", criterionId: "c2", score: 3 },
    ]);

    const scoreA = apartmentScore(criteria, all, "a").score;
    const scoreB = apartmentScore(criteria, all, "b").score;

    expect(scoreA).toBeGreaterThan(70);
    expect(scoreB).toBe(0);
  });

  it("ranks two apartments differently for the same user", () => {
    const aptA = computeScore(criteria, [
      { criterionId: "c1", score: 9 },
      { criterionId: "c2", score: 8 },
    ]);
    const aptB = computeScore(criteria, [
      { criterionId: "c1", score: 6 },
      { criterionId: "c2", score: 5 },
    ]);

    expect(aptA.score).toBeGreaterThan(aptB.score);
  });
});
