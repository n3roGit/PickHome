import { describe, expect, it } from "vitest";
import { APARTMENT_REVISION_FIELD, parseExpectedRevision } from "@/lib/apartment-revision";

describe("apartment revision", () => {
  it("parseExpectedRevision reads non-negative integer", () => {
    const form = new FormData();
    form.set(APARTMENT_REVISION_FIELD, "3");
    expect(parseExpectedRevision(form)).toBe(3);
  });

  it("parseExpectedRevision rejects missing or invalid", () => {
    expect(parseExpectedRevision(new FormData())).toBeNull();
    const bad = new FormData();
    bad.set(APARTMENT_REVISION_FIELD, "-1");
    expect(parseExpectedRevision(bad)).toBeNull();
  });
});
