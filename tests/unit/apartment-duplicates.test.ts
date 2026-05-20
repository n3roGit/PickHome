import { describe, expect, it } from "vitest";
import {
  buildDuplicateIndex,
  findDuplicatesForApartment,
  normalizeAddressKey,
} from "@/lib/apartment-duplicates";

describe("apartment-duplicates", () => {
  it("normalizes addresses for comparison", () => {
    expect(normalizeAddressKey("Musterstraße 1, 28195 Bremen")).toBe(
      normalizeAddressKey("Musterstrasse 1, 28195 Bremen")
    );
  });

  it("detects same address", () => {
    const matches = findDuplicatesForApartment(
      { id: "a1", title: "Wohnung A", address: "Hauptstr. 5, 28195 Bremen" },
      [{ id: "a2", title: "Anders", address: "Hauptstraße 5, 28195 Bremen" }]
    );
    expect(matches).toHaveLength(1);
    expect(matches[0].reason).toBe("address");
  });

  it("detects similar titles", () => {
    const matches = findDuplicatesForApartment(
      { id: "a1", title: "3-Zimmer Wohnung Arsten", address: null },
      [{ id: "a2", title: "3 Zimmer Wohnung in Arsten", address: "Andere Str. 1" }]
    );
    expect(matches.some((m) => m.reason === "title")).toBe(true);
  });

  it("ignores empty addresses without title match", () => {
    const index = buildDuplicateIndex([
      { id: "a1", title: "Alpha", address: null },
      { id: "a2", title: "Beta", address: null },
    ]);
    expect(index.size).toBe(0);
  });
});
