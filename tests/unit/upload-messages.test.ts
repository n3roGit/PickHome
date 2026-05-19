import { describe, expect, it } from "vitest";
import {
  apartmentDocumentUploadErrorMessage,
  apartmentPhotoUploadErrorMessage,
} from "@/lib/upload-messages";

describe("upload error messages", () => {
  it("describes oversized photos", () => {
    expect(apartmentPhotoUploadErrorMessage("too_large", "a.jpg")).toContain("10 MB");
  });

  it("describes oversized documents", () => {
    expect(apartmentDocumentUploadErrorMessage("too_large", "expose.pdf")).toContain("30 MB");
  });
});
