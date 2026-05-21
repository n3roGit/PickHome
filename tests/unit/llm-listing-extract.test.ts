import { describe, expect, it } from "vitest";
import {
  mergeListingPreviewFields,
  normalizeLlmListingExtract,
  parseLlmListingJson,
  truncateListingSourceText,
} from "@/lib/llm-listing-extract";

describe("mergeListingPreviewFields", () => {
  it("fills only empty base fields from extra", () => {
    const merged = mergeListingPreviewFields(
      { title: "Bestehend", price: 200000 },
      { title: "Neu", price: 300000, sizeSqm: 90 }
    );
    expect(merged.title).toBe("Bestehend");
    expect(merged.price).toBe(200000);
    expect(merged.sizeSqm).toBe(90);
  });
});

describe("parseLlmListingJson", () => {
  it("parses fenced JSON", () => {
    const raw = parseLlmListingJson('```json\n{"price": 450000, "sizeSqm": 80}\n```');
    expect(raw?.price).toBe(450000);
    expect(raw?.sizeSqm).toBe(80);
  });
});

describe("normalizeLlmListingExtract", () => {
  it("normalizes German fields", () => {
    const fields = normalizeLlmListingExtract({
      title: "  Wohnung Mitte  ",
      price: "350.000",
      energyClass: "b",
      address: "Exampleweg 1, 12345 Teststadt",
    });
    expect(fields.title).toBe("Wohnung Mitte");
    expect(fields.price).toBe(350000);
    expect(fields.energyClass).toBe("B");
  });
});

describe("truncateListingSourceText", () => {
  it("caps long input", () => {
    const long = "a".repeat(100_000);
    expect(truncateListingSourceText(long).length).toBeLessThan(100_000);
  });
});
