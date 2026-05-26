import { describe, expect, it } from "vitest";
import {
  getSeasonMidDate,
  parseDateInput,
  parseOptionalDateQuery,
  toDateInputValue,
} from "@/lib/solar-seasons";

describe("solar-seasons", () => {
  it("getSeasonMidDate uses reference year", () => {
    const ref = new Date(2026, 5, 1);
    expect(toDateInputValue(getSeasonMidDate(ref, "summer"))).toBe("2026-07-15");
    expect(toDateInputValue(getSeasonMidDate(ref, "winter"))).toBe("2026-01-15");
  });

  it("parseOptionalDateQuery accepts ISO date only", () => {
    expect(parseOptionalDateQuery("2026-04-15")?.getDate()).toBe(15);
    expect(parseOptionalDateQuery("invalid")).toBeUndefined();
    expect(parseOptionalDateQuery(undefined)).toBeUndefined();
  });

  it("parseDateInput round-trips with toDateInputValue", () => {
    const d = parseDateInput("2025-10-15");
    expect(toDateInputValue(d)).toBe("2025-10-15");
  });
});
