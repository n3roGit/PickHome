import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as externalFetch from "@/lib/external-fetch";
import { fetchRoute, osrmEndpointForMode } from "@/lib/routing";

describe("fetchRoute", () => {
  const from = { latitude: 53.08, longitude: 8.8 };
  const to = { latitude: 53.1, longitude: 8.85 };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses mode-specific FOSSGIS endpoints", () => {
    expect(osrmEndpointForMode("foot").baseUrl).toContain("routed-foot");
    expect(osrmEndpointForMode("bike").baseUrl).toContain("routed-bike");
    expect(osrmEndpointForMode("driving").baseUrl).toContain("routed-car");
  });

  it("returns distance and duration on success", async () => {
    const fetchSpy = vi.spyOn(externalFetch, "fetchExternal").mockResolvedValue(
      new Response(
        JSON.stringify({ routes: [{ distance: 5000, duration: 900 }] }),
        { status: 200 }
      )
    );
    const route = await fetchRoute(from, to, "foot");
    expect(route).toEqual({ distanceMeters: 5000, durationSeconds: 900 });
    const url = fetchSpy.mock.calls[0]?.[1] as string;
    expect(url).toContain("/routed-foot/");
    expect(url).toContain("/foot/");
  });

  it("returns null when routes array is empty", async () => {
    vi.spyOn(externalFetch, "fetchExternal").mockResolvedValue(
      new Response(JSON.stringify({ routes: [] }), { status: 200 })
    );
    expect(await fetchRoute(from, to, "bike")).toBeNull();
  });

  it("returns null on invalid JSON", async () => {
    vi.spyOn(externalFetch, "fetchExternal").mockResolvedValue(
      new Response("not json", { status: 200 })
    );
    expect(await fetchRoute(from, to, "driving")).toBeNull();
  });

  it("returns null when fetchExternal fails", async () => {
    vi.spyOn(externalFetch, "fetchExternal").mockResolvedValue(null);
    expect(await fetchRoute(from, to, "driving")).toBeNull();
  });
});
