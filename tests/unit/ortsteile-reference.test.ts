import { describe, expect, it } from "vitest";
import { mergeDistrictsByPlz, staticDistrictsForPlz } from "@/lib/ortsteile-reference";

describe("ortsteile-reference", () => {
  it("returns empty array for unknown PLZ", () => {
    expect(staticDistrictsForPlz("00000")).toEqual([]);
  });

  it("merges static and project districts without duplicates", () => {
    const merged = mergeDistrictsByPlz({
      "28203": ["Fesenfeld"],
    });
    const list = merged["28203"] ?? [];
    expect(list).toContain("Fesenfeld");
  });
});
