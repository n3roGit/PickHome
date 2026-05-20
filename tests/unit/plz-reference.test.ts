import { describe, expect, it } from "vitest";
import { findOrtByKey, getPlzReferenceData, searchOrte } from "@/lib/plz-reference";

describe("plz-reference", () => {
  it("loads nationwide PLZ data", () => {
    const data = getPlzReferenceData();
    expect(data.plzCount).toBeGreaterThan(8000);
    expect(data.bundeslaender.length).toBe(16);
  });

  it("finds Bremen with PLZ list", () => {
    const bremen = findOrtByKey("Bremen|Bremen");
    expect(bremen).not.toBeNull();
    expect(bremen!.plz).toContain("28203");
  });

  it("searches orte by prefix", () => {
    const results = searchOrte("Bremen", "Bremen");
    expect(results.some((o) => o.name === "Bremen")).toBe(true);
  });
});
