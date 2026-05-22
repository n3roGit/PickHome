import { describe, expect, it } from "vitest";
import {
  computeListingFieldSuggestions,
  formatListingSuggestionValue,
} from "@/lib/listing-field-suggestions";
import type { ListingPreviewFields } from "@/lib/listing-import";

describe("formatListingSuggestionValue", () => {
  it("formats price and broker", () => {
    expect(formatListingSuggestionValue("price", { price: 320_000 })).toContain("320");
    expect(formatListingSuggestionValue("brokerInvolved", { brokerInvolved: true })).toBe(
      "Mit Makler"
    );
  });
});

describe("valuesEqual (via compute with mock DOM)", () => {
  it("computeListingFieldSuggestions returns empty without document", () => {
    const proposed: ListingPreviewFields = { price: 400_000, energyClass: "C" };
    expect(computeListingFieldSuggestions("apt-test", proposed)).toEqual([]);
  });
});
