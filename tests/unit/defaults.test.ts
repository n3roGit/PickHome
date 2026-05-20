import { describe, expect, it } from "vitest";
import { DEFAULT_CRITERIA_GROUPS } from "@/lib/defaults";

describe("DEFAULT_CRITERIA_GROUPS", () => {
  it("has non-empty groups with criteria", () => {
    expect(DEFAULT_CRITERIA_GROUPS.length).toBeGreaterThan(0);
    for (const group of DEFAULT_CRITERIA_GROUPS) {
      expect(group.name.trim()).not.toBe("");
      expect(group.criteria.length).toBeGreaterThan(0);
    }
  });

  it("uses unique criterion names within each group", () => {
    for (const group of DEFAULT_CRITERIA_GROUPS) {
      const names = group.criteria.map((c) => c.name);
      expect(new Set(names).size).toBe(names.length);
    }
  });

  it("keeps weights in range 1..5", () => {
    for (const group of DEFAULT_CRITERIA_GROUPS) {
      for (const c of group.criteria) {
        expect(c.weight).toBeGreaterThanOrEqual(1);
        expect(c.weight).toBeLessThanOrEqual(5);
      }
    }
  });

  it("includes known dealbreakers", () => {
    const all = DEFAULT_CRITERIA_GROUPS.flatMap((g) => g.criteria);
    const dealbreakers = all.filter((c) => c.isDealbreaker).map((c) => c.name);
    expect(dealbreakers).toContain("Kaufpreis");
    expect(dealbreakers).toContain("Fluglärm");
  });
});
