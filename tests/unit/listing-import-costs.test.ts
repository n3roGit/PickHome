import { describe, expect, it } from "vitest";
import { parseListingPlainText } from "@/lib/listing-import";

describe("parseListingPlainText cost fields", () => {
  it("extracts hausgeld from synthetic exposé text", () => {
    const fields = parseListingPlainText(
      "Kaufpreis 350.000 EUR. Hausgeld: 275 Euro monatlich. Heizkosten 95 €."
    );
    expect(fields.hoaFeeMonthly).toBe(275);
    expect(fields.heatingCostMonthly).toBe(95);
  });
});
