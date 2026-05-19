import { describe, expect, it } from "vitest";
import { normalizeListingUrl } from "@/lib/listing-url";

describe("normalizeListingUrl", () => {
  it("returns null for empty input", () => {
    expect(normalizeListingUrl("")).toBeNull();
    expect(normalizeListingUrl("   ")).toBeNull();
  });

  it("adds https when missing", () => {
    expect(normalizeListingUrl("www.example.com/listing")).toBe("https://www.example.com/listing");
  });

  it("keeps valid https URLs", () => {
    expect(normalizeListingUrl("https://immobilienscout24.de/expose/123")).toBe(
      "https://immobilienscout24.de/expose/123"
    );
  });

  it("rejects invalid URLs", () => {
    expect(normalizeListingUrl("not a url")).toBeNull();
    expect(normalizeListingUrl("javascript:alert(1)")).toBeNull();
  });
});
