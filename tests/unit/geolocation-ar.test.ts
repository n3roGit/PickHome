import { describe, expect, it } from "vitest";
import { mapGeolocationError } from "@/lib/geolocation-ar";

describe("mapGeolocationError", () => {
  it("maps permission denied", () => {
    const err = { code: 1, PERMISSION_DENIED: 1, TIMEOUT: 3, POSITION_UNAVAILABLE: 2 } as GeolocationPositionError;
    expect(mapGeolocationError(err)).toBe("location_denied");
  });

  it("maps timeout", () => {
    const err = { code: 3, PERMISSION_DENIED: 1, TIMEOUT: 3, POSITION_UNAVAILABLE: 2 } as GeolocationPositionError;
    expect(mapGeolocationError(err)).toBe("location_timeout");
  });

  it("maps position unavailable", () => {
    const err = { code: 2, PERMISSION_DENIED: 1, TIMEOUT: 3, POSITION_UNAVAILABLE: 2 } as GeolocationPositionError;
    expect(mapGeolocationError(err)).toBe("location_unavailable");
  });
});

describe("isGeolocationSupported", () => {
  it("returns false without navigator.geolocation", async () => {
    const { isGeolocationSupported } = await import("@/lib/geolocation-ar");
    expect(isGeolocationSupported()).toBe(false);
  });
});
