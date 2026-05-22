import { describe, expect, it } from "vitest";
import {
  keysForSavedFlags,
  pruneApartmentListingDraft,
  type ApartmentListingDraft,
} from "@/lib/apartment-listing-draft";

describe("apartment-listing-draft", () => {
  const draft: ApartmentListingDraft = {
    fields: {
      title: "Test listing",
      description: "Nice flat",
      price: 350000,
    },
    pending: ["title", "description", "price"],
  };

  it("maps saved flags to field keys", () => {
    expect(keysForSavedFlags({ title: true })).toEqual(["title"]);
    expect(keysForSavedFlags({ basics: true })).toEqual([
      "price",
      "address",
      "sizeSqm",
      "plotSizeSqm",
      "energyClass",
      "hoaFeeMonthly",
      "heatingCostMonthly",
      "propertyTaxAnnual",
      "renovationCost",
    ]);
  });

  it("prunes cost fields when basics block was saved", () => {
    const costDraft: ApartmentListingDraft = {
      fields: { heatingCostMonthly: 300, propertyTaxAnnual: 600 },
      pending: ["heatingCostMonthly", "propertyTaxAnnual"],
    };
    expect(pruneApartmentListingDraft(costDraft, { basics: true })).toBeNull();
  });

  it("prunes only keys saved in this navigation", () => {
    const afterTitle = pruneApartmentListingDraft(draft, { title: true });
    expect(afterTitle?.pending).toEqual(["description", "price"]);
    expect(afterTitle?.fields.description).toBe("Nice flat");
  });

  it("returns null when all pending keys were saved", () => {
    const cleared = pruneApartmentListingDraft(draft, {
      title: true,
      description: true,
      basics: true,
    });
    expect(cleared).toBeNull();
  });
});
