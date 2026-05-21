import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/listing-import", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/listing-import")>();
  return {
    ...actual,
    fetchListingPreview: vi.fn(),
  };
});

vi.mock("@/lib/llm-client", () => ({
  isLlmConfigured: vi.fn(),
}));

vi.mock("@/lib/llm-listing-extract", () => ({
  enrichListingFieldsWithLlm: vi.fn(),
  mergeListingPreviewFields: vi.fn((base, extra) => ({ ...base, ...extra })),
}));

import { importApartmentListingFields } from "@/lib/apartment-listing-import";
import { fetchListingPreview } from "@/lib/listing-import";
import { isLlmConfigured } from "@/lib/llm-client";
import { enrichListingFieldsWithLlm } from "@/lib/llm-listing-extract";

describe("importApartmentListingFields", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns url preview when no pdf text", async () => {
    vi.mocked(fetchListingPreview).mockResolvedValue({
      ok: true,
      fields: { price: 350000, address: "Exampleweg 1" },
      warnings: [],
    });

    const result = await importApartmentListingFields({
      listingUrl: "https://example.com/listing",
      pdfText: "",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.fields.price).toBe(350000);
    }
    expect(fetchListingPreview).toHaveBeenCalledWith("https://example.com/listing");
    expect(enrichListingFieldsWithLlm).not.toHaveBeenCalled();
  });

  it("merges pdf llm fields over url preview", async () => {
    vi.mocked(fetchListingPreview).mockResolvedValue({
      ok: true,
      fields: { price: 350000 },
      warnings: [],
      llmUsed: true,
    });
    vi.mocked(isLlmConfigured).mockResolvedValue(true);
    vi.mocked(enrichListingFieldsWithLlm).mockResolvedValue({
      fields: { energyClass: "D", sizeSqm: 120 },
      llmUsed: true,
      highlights: "Keller",
    });

    const result = await importApartmentListingFields({
      listingUrl: "https://example.com/listing",
      pdfText: "x".repeat(100),
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.fields).toEqual({
        price: 350000,
        energyClass: "D",
        sizeSqm: 120,
        description: "Keller",
      });
      expect(result.highlights).toBe("Keller");
    }
    expect(enrichListingFieldsWithLlm).toHaveBeenCalled();
  });

  it("parses pdf text without llm when no url", async () => {
    vi.mocked(isLlmConfigured).mockResolvedValue(false);
    const pdfText =
      "Kaufpreis 349.000 €, Wohnfläche 129 m², Energieeffizienzklasse F, " +
      "Richtweg 5, 28816 Stuhr. ".repeat(5);

    const result = await importApartmentListingFields({
      listingUrl: null,
      pdfText,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.fields.price).toBe(349000);
      expect(result.fields.sizeSqm).toBe(129);
      expect(result.fields.energyClass).toBe("F");
    }
    expect(enrichListingFieldsWithLlm).not.toHaveBeenCalled();
  });
});
