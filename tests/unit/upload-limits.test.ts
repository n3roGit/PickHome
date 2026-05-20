import { describe, expect, it } from "vitest";
import {
  isApartmentUploadError,
  MAX_DOCUMENT_BYTES,
  MAX_DOCUMENT_MB,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_MB,
} from "@/lib/upload-limits";

describe("upload-limits", () => {
  it("exposes byte and MB limits", () => {
    expect(MAX_IMAGE_MB).toBe(10);
    expect(MAX_DOCUMENT_MB).toBe(30);
    expect(MAX_IMAGE_BYTES).toBe(10 * 1024 * 1024);
    expect(MAX_DOCUMENT_BYTES).toBe(30 * 1024 * 1024);
  });

  it("recognizes upload error codes", () => {
    expect(isApartmentUploadError("too_large")).toBe(true);
    expect(isApartmentUploadError("invalid_type")).toBe(true);
    expect(isApartmentUploadError("other")).toBe(false);
  });
});
