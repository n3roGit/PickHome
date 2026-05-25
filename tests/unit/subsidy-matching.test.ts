import { describe, expect, it } from "vitest";
import { matchApartmentSubsidies } from "@/lib/subsidy-matching";

const CURRENT_YEAR = new Date().getFullYear();

function ids(matches: ReturnType<typeof matchApartmentSubsidies>): string[] {
  return matches.map((m) => m.program.id);
}

function statusOf(
  matches: ReturnType<typeof matchApartmentSubsidies>,
  id: string
): string | undefined {
  return matches.find((m) => m.program.id === id)?.status;
}

describe("matchApartmentSubsidies", () => {
  it("shows KfW 124 as possible with minimal purchase data", () => {
    const matches = matchApartmentSubsidies({ address: "Exampleweg 1, 10115 Teststadt" });
    expect(statusOf(matches, "kfw-124")).toBe("possible");
    expect(ids(matches)).toContain("regional-fdb");
  });

  it("marks energetic programs as needs-data when no building signals exist", () => {
    const matches = matchApartmentSubsidies({});
    expect(statusOf(matches, "kfw-261")).toBe("needs-data");
    expect(statusOf(matches, "kfw-458")).toBe("needs-data");
    expect(statusOf(matches, "bafa-beg-em")).toBe("needs-data");
    const kfw300 = matches.find((m) => m.program.id === "kfw-300");
    expect(kfw300?.status).toBe("needs-data");
    expect(kfw300?.missingData).toContain("Baujahr");
  });

  it("suggests new-build programs for recent yearBuilt and good energy class", () => {
    const matches = matchApartmentSubsidies({
      yearBuilt: CURRENT_YEAR - 1,
      energyClass: "A+",
    });
    expect(statusOf(matches, "kfw-297")).toBe("possible");
    expect(statusOf(matches, "kfw-298")).toBe("possible");
    expect(statusOf(matches, "kfw-300")).toBe("possible");
  });

  it("marks renovation programs as relevant when renovationCost is set", () => {
    const matches = matchApartmentSubsidies({
      yearBuilt: 1985,
      energyClass: "E",
      renovationCost: 30000,
    });
    expect(statusOf(matches, "kfw-261")).toBe("relevant");
    expect(statusOf(matches, "kfw-458")).toBe("relevant");
    expect(statusOf(matches, "bafa-beg-em")).toBe("relevant");
  });

  it("suggests renovation programs as possible for older buildings with poor energy class", () => {
    const matches = matchApartmentSubsidies({
      yearBuilt: 1970,
      energyClass: "F",
    });
    expect(statusOf(matches, "kfw-261")).toBe("possible");
    expect(statusOf(matches, "kfw-458")).toBe("possible");
    expect(statusOf(matches, "bafa-beg-em")).toBe("possible");
  });

  it("includes helpful missingData when energy signals are absent", () => {
    const matches = matchApartmentSubsidies({});
    const kfw261 = matches.find((m) => m.program.id === "kfw-261");
    expect(kfw261?.missingData.length).toBeGreaterThan(0);
    expect(kfw261?.missingData).toContain("Baujahr");
  });

  it("sorts relevant matches before possible and needs-data", () => {
    const matches = matchApartmentSubsidies({
      yearBuilt: 1980,
      renovationCost: 15000,
    });
    const statuses = matches.map((m) => m.status);
    const firstNeedsData = statuses.indexOf("needs-data");
    const lastRelevant = statuses.lastIndexOf("relevant");
    if (firstNeedsData >= 0 && lastRelevant >= 0) {
      expect(lastRelevant).toBeLessThan(firstNeedsData);
    }
  });
});
