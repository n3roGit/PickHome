import { describe, expect, it } from "vitest";
import {
  budgetDelta,
  computeScore,
  formatBudgetHint,
  formatPrice,
  parseApartmentSort,
  pricePerPoint,
  scoreColor,
  sortApartments,
} from "@/lib/scoring";

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

  it("does not trigger dealbreaker above threshold (score 4)", () => {
    const result = computeScore(criteria, [
      { criterionId: "a", score: 4 },
      { criterionId: "b", score: 10 },
    ]);
    expect(result.dealbreaker).toBe(false);
    expect(result.score).toBeGreaterThan(0);
  });

  it("triggers dealbreaker exactly at threshold (score 3)", () => {
    const result = computeScore(criteria, [{ criterionId: "a", score: 3 }]);
    expect(result.dealbreaker).toBe(true);
    expect(result.score).toBe(0);
  });

  it("low non-dealbreaker score does not zero the total", () => {
    const result = computeScore(criteria, [
      { criterionId: "a", score: 10 },
      { criterionId: "b", score: 1 },
    ]);
    expect(result.dealbreaker).toBe(false);
    // (5*1.0 + 3*0.1) / 8 * 100 = 66.25 -> 66
    expect(result.score).toBe(66);
  });

  it("weights higher-impact criteria more in the total", () => {
    const heavyLow = computeScore(criteria, [
      { criterionId: "a", score: 4 },
      { criterionId: "b", score: 10 },
    ]);
    const lightLow = computeScore(criteria, [
      { criterionId: "a", score: 10 },
      { criterionId: "b", score: 4 },
    ]);
    expect(heavyLow.score).toBeLessThan(lightLow.score);
  });
});

describe("computeScore ranking scenarios", () => {
  const criteria = [
    { id: "location", weight: 5, isDealbreaker: false },
    { id: "price", weight: 3, isDealbreaker: false },
  ];

  it("ranks fully rated apartment above partially weaker ratings", () => {
    const strong = computeScore(criteria, [
      { criterionId: "location", score: 9 },
      { criterionId: "price", score: 8 },
    ]);
    const weak = computeScore(criteria, [
      { criterionId: "location", score: 5 },
      { criterionId: "price", score: 6 },
    ]);
    expect(strong.score).toBeGreaterThan(weak.score);
  });

  it("dealbreaker apartment sorts below any non-dealbreaker score", () => {
    const rejected = computeScore(
      [{ id: "must", weight: 4, isDealbreaker: true }],
      [{ criterionId: "must", score: 2 }]
    );
    const acceptable = computeScore(criteria, [{ criterionId: "location", score: 5 }]);
    expect(rejected.score).toBe(0);
    expect(rejected.dealbreaker).toBe(true);
    expect(acceptable.score).toBeGreaterThan(rejected.score);
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

describe("parseApartmentSort", () => {
  it("defaults to score for unknown values", () => {
    expect(parseApartmentSort(undefined)).toBe("score");
    expect(parseApartmentSort("invalid")).toBe("score");
  });

  it("accepts known sort keys", () => {
    expect(parseApartmentSort("price")).toBe("price");
    expect(parseApartmentSort("ppp")).toBe("ppp");
    expect(parseApartmentSort("date")).toBe("date");
  });
});

describe("sortApartments", () => {
  const base = [
    { id: "a", score: 80, price: 500_000, createdAt: new Date("2024-01-01") },
    { id: "b", score: 60, price: 300_000, createdAt: new Date("2024-06-01") },
    { id: "c", score: 40, price: null, createdAt: new Date("2024-03-01") },
  ];

  it("sorts by score descending by default", () => {
    const sorted = sortApartments(base, "score");
    expect(sorted.map((a) => a.id)).toEqual(["a", "b", "c"]);
  });

  it("sorts by price ascending", () => {
    const sorted = sortApartments(base, "price");
    expect(sorted.map((a) => a.id)).toEqual(["b", "a", "c"]);
  });

  it("sorts by date descending", () => {
    const sorted = sortApartments(base, "date");
    expect(sorted.map((a) => a.id)).toEqual(["b", "c", "a"]);
  });
});

describe("budgetDelta", () => {
  it("returns null when price or budget missing", () => {
    expect(budgetDelta(null, 400_000)).toBeNull();
    expect(budgetDelta(500_000, null)).toBeNull();
  });

  it("computes over and under budget", () => {
    expect(budgetDelta(550_000, 500_000)).toEqual({ pct: 10, over: true });
    expect(budgetDelta(450_000, 500_000)).toEqual({ pct: -10, over: false });
    expect(budgetDelta(500_000, 500_000)).toEqual({ pct: 0, over: false });
  });
});

describe("formatBudgetHint", () => {
  it("formats German hints", () => {
    expect(formatBudgetHint(550_000, 500_000)).toBe("10 % über Budget");
    expect(formatBudgetHint(450_000, 500_000)).toBe("10 % unter Budget");
    expect(formatBudgetHint(500_000, 500_000)).toBe("Im Budget");
  });
});
