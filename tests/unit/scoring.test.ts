import { describe, expect, it } from "vitest";
import { computeScore, formatPrice, pricePerPoint, scoreColor } from "@/lib/scoring";

const criteria = [
  { id: "a", weight: 5, isDealbreaker: true },
  { id: "b", weight: 3, isDealbreaker: false },
];

describe("computeScore", () => {
  it("returns zero when no ratings", () => {
    expect(computeScore(criteria, [])).toEqual({
      score: 0,
      dealbreaker: false,
      rated: 0,
      total: 2,
    });
  });

  it("computes weighted score from ratings", () => {
    const result = computeScore(criteria, [
      { criterionId: "a", score: 8 },
      { criterionId: "b", score: 6 },
    ]);
    // (5*0.8 + 3*0.6) / 8 * 100 = 72.5 -> 73
    expect(result.score).toBe(73);
    expect(result.dealbreaker).toBe(false);
    expect(result.rated).toBe(2);
  });

  it("flags dealbreaker when score is at or below threshold", () => {
    const result = computeScore(criteria, [
      { criterionId: "a", score: 3 },
      { criterionId: "b", score: 10 },
    ]);
    expect(result.dealbreaker).toBe(true);
    expect(result.score).toBe(0);
  });

  it("ignores unrated criteria in weight total", () => {
    const result = computeScore(criteria, [{ criterionId: "b", score: 10 }]);
    expect(result.score).toBe(100);
    expect(result.rated).toBe(1);
    expect(result.total).toBe(2);
  });
});

describe("scoreColor", () => {
  it("returns low for dealbreaker or low score", () => {
    expect(scoreColor(80, true)).toBe("low");
    expect(scoreColor(40, false)).toBe("low");
  });

  it("returns high for strong scores", () => {
    expect(scoreColor(71, false)).toBe("high");
  });

  it("returns mid otherwise", () => {
    expect(scoreColor(50, false)).toBe("mid");
  });
});

describe("formatPrice", () => {
  it("formats EUR without cents", () => {
    expect(formatPrice(349_000)).toMatch(/349\.000/);
  });

  it("returns dash for null", () => {
    expect(formatPrice(null)).toBe("—");
  });
});

describe("pricePerPoint", () => {
  it("returns null when price or score missing", () => {
    expect(pricePerPoint(null, 50)).toBeNull();
    expect(pricePerPoint(100_000, 0)).toBeNull();
  });

  it("divides price by score", () => {
    expect(pricePerPoint(100_000, 50)).toMatch(/2\.000/);
  });
});
