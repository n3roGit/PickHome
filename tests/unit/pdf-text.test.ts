import { describe, expect, it } from "vitest";
import {
  MAX_EXTRACTED_PDF_TEXT_LENGTH,
  normalizeExtractedPdfText,
} from "@/lib/pdf-text";

describe("normalizeExtractedPdfText", () => {
  it("collapses whitespace and trims", () => {
    expect(normalizeExtractedPdfText("  Baujahr   1910 \n Keller  ")).toBe("Baujahr 1910 Keller");
  });

  it("truncates very long text", () => {
    const long = "a".repeat(MAX_EXTRACTED_PDF_TEXT_LENGTH + 100);
    expect(normalizeExtractedPdfText(long).length).toBe(MAX_EXTRACTED_PDF_TEXT_LENGTH);
  });

  it("returns empty for whitespace-only input", () => {
    expect(normalizeExtractedPdfText("   \n  ")).toBe("");
  });
});
