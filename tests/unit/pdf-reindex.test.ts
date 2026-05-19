import { describe, expect, it } from "vitest";
import { isPdfDocument } from "@/lib/pdf-reindex";

describe("isPdfDocument", () => {
  it("accepts pdf mime type", () => {
    expect(isPdfDocument("application/pdf", "/uploads/x/documents/a.bin")).toBe(true);
  });

  it("accepts pdf file extension", () => {
    expect(isPdfDocument("application/octet-stream", "/uploads/x/documents/a.pdf")).toBe(true);
  });

  it("rejects non-pdf", () => {
    expect(isPdfDocument("image/jpeg", "/uploads/x/photo.jpg")).toBe(false);
  });
});
