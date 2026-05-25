import { describe, expect, it } from "vitest";
import { apartmentPdfFilename } from "@/lib/apartment-pdf-data";

describe("apartmentPdfFilename", () => {
  it("builds a safe attachment name from the title", () => {
    expect(apartmentPdfFilename("Habenhausen")).toBe("Habenhausen.pdf");
  });

  it("replaces unsafe characters and collapses whitespace", () => {
    expect(apartmentPdfFilename('Test / "Objekt"  #1')).toBe("Test-Objekt-1.pdf");
  });

  it("falls back when the title is empty", () => {
    expect(apartmentPdfFilename("   ")).toBe("immobilie.pdf");
  });
});
