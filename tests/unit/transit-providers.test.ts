import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_TRANSIT_API_BASES,
  resolveTransitApiBases,
} from "@/lib/transit-providers";

describe("resolveTransitApiBases", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns default providers", () => {
    vi.stubEnv("TRANSIT_API_BASES", "");
    expect(resolveTransitApiBases()).toEqual([...DEFAULT_TRANSIT_API_BASES]);
  });

  it("honors TRANSIT_API_BASES override", () => {
    vi.stubEnv(
      "TRANSIT_API_BASES",
      "https://custom.example/, https://v6.db.transport.rest/"
    );
    expect(resolveTransitApiBases()).toEqual([
      "https://custom.example",
      "https://v6.db.transport.rest",
    ]);
  });
});
