import { beforeEach, describe, expect, it } from "vitest";
import { checkRateLimit, clearRateLimits, resetRateLimit } from "@/lib/rate-limit";

describe("rate limit", () => {
  beforeEach(() => clearRateLimits());

  it("allows attempts below the limit", () => {
    expect(checkRateLimit("login:user", 2, 60_000, 1_000)).toBe(true);
    expect(checkRateLimit("login:user", 2, 60_000, 2_000)).toBe(true);
  });

  it("blocks attempts above the limit", () => {
    expect(checkRateLimit("login:user", 1, 60_000, 1_000)).toBe(true);
    expect(checkRateLimit("login:user", 1, 60_000, 2_000)).toBe(false);
  });

  it("allows attempts again after the window expires", () => {
    expect(checkRateLimit("login:user", 1, 60_000, 1_000)).toBe(true);
    expect(checkRateLimit("login:user", 1, 60_000, 2_000)).toBe(false);
    expect(checkRateLimit("login:user", 1, 60_000, 61_001)).toBe(true);
  });

  it("can reset a key after successful authentication", () => {
    expect(checkRateLimit("login:user", 1, 60_000, 1_000)).toBe(true);
    expect(checkRateLimit("login:user", 1, 60_000, 2_000)).toBe(false);
    resetRateLimit("login:user");
    expect(checkRateLimit("login:user", 1, 60_000, 3_000)).toBe(true);
  });
});
