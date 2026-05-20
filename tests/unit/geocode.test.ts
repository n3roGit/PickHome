import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as externalFetch from "@/lib/external-fetch";
import { geocodeAddress } from "@/lib/geocode";

describe("geocodeAddress", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null for empty input", async () => {
    expect(await geocodeAddress("")).toBeNull();
    expect(await geocodeAddress("   ")).toBeNull();
  });

  it("returns null when API has no results", async () => {
    vi.spyOn(externalFetch, "fetchExternal").mockResolvedValue(
      new Response(JSON.stringify([]), { status: 200 })
    );
    expect(await geocodeAddress("Nowhere")).toBeNull();
  });

  it("returns coordinates on success", async () => {
    vi.spyOn(externalFetch, "fetchExternal").mockResolvedValue(
      new Response(JSON.stringify([{ lat: "53.0793", lon: "8.8017" }]), { status: 200 })
    );
    const coords = await geocodeAddress("Bremen");
    expect(coords).toEqual({ latitude: 53.0793, longitude: 8.8017 });
  });

  it("returns null when fetch fails", async () => {
    vi.spyOn(externalFetch, "fetchExternal").mockResolvedValue(null);
    expect(await geocodeAddress("Bremen")).toBeNull();
  });
});
