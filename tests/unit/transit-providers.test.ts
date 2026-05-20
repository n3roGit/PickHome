import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_TRANSIT_API_BASES,
  DEFAULT_TRANSIT_GTFS_API_BASE,
  resolveTransitApiBases,
  resolveTransitGtfsApiBase,
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

describe("resolveTransitGtfsApiBase", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns default MOTIS base", () => {
    vi.stubEnv("TRANSIT_GTFS_API_BASE", "");
    expect(resolveTransitGtfsApiBase()).toBe(DEFAULT_TRANSIT_GTFS_API_BASE);
  });

  it("honors TRANSIT_GTFS_API_BASE override", () => {
    vi.stubEnv("TRANSIT_GTFS_API_BASE", "https://motis.example/");
    expect(resolveTransitGtfsApiBase()).toBe("https://motis.example");
  });

  it("can disable GTFS fallback", () => {
    vi.stubEnv("TRANSIT_GTFS_API_BASE", "off");
    expect(resolveTransitGtfsApiBase()).toBeNull();
  });
});
