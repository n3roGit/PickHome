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

  it("enriches from supplemental saved context on detail Auto-Fill", async () => {
    vi.mocked(fetchListingPreview).mockResolvedValue({
      ok: false,
      error: "fetch_failed",
      warnings: ["blocked"],
    });
    vi.mocked(isLlmConfigured).mockResolvedValue(true);
    vi.mocked(enrichListingFieldsWithLlm).mockResolvedValue({
      fields: { price: 420000, energyClass: "C" },
      llmUsed: true,
    });

    const supplement = [
      "--- Bereits in PickHome erfasst ---",
      "Eigene Notizen:",
      "Budget 420k, Energie C laut Makler-Mail",
    ].join("\n");

    const result = await importApartmentListingFields({
      listingUrl: null,
      pdfText: "",
      supplementalContext: supplement.repeat(10),
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.fields.price).toBe(420000);
      expect(result.fields.energyClass).toBe("C");
      expect(result.warnings.some((w) => w.includes("bereits erfasste"))).toBe(true);
    }
    expect(enrichListingFieldsWithLlm).toHaveBeenCalledWith({}, expect.stringContaining("PickHome"));
  });

  it("parses supplemental context without LLM when notes mention energy and area", async () => {
    vi.mocked(isLlmConfigured).mockResolvedValue(false);
    const supplement = [
      "--- Bereits in PickHome erfasst ---",
      "Eigene Notizen:",
      "Energieklasse laut Besichtigung: D. Wohnfläche ca. 95 m². Grundstück etwa 400 m².",
    ].join("\n");

    const result = await importApartmentListingFields({
      listingUrl: null,
      pdfText: "",
      supplementalContext: supplement.repeat(8),
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.fields.energyClass).toBe("D");
      expect(result.fields.sizeSqm).toBe(95);
      expect(result.fields.plotSizeSqm).toBe(400);
      expect(result.warnings.some((w) => w.includes("bereits erfasste"))).toBe(true);
    }
    expect(enrichListingFieldsWithLlm).not.toHaveBeenCalled();
  });
});
