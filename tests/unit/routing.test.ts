import { describe, expect, it } from "vitest";
import {
  formatRouteDistance,
  formatRouteDuration,
  osrmEndpointForMode,
  osrmProfileForMode,
} from "@/lib/routing";

describe("formatRouteDistance", () => {
  it("formats meters", () => {
    expect(formatRouteDistance(450)).toBe("450 m");
  });

  it("formats kilometers", () => {
    expect(formatRouteDistance(1250)).toBe("1,3 km");
    expect(formatRouteDistance(10_000)).toBe("10 km");
  });
});

describe("formatRouteDuration", () => {
  it("formats minutes", () => {
    expect(formatRouteDuration(90)).toBe("2 Min.");
  });

  it("formats hours", () => {
    expect(formatRouteDuration(3600)).toBe("1 Std.");
    expect(formatRouteDuration(5400)).toBe("1 Std. 30 Min.");
  });
});

describe("osrmEndpointForMode", () => {
  it("uses mode-specific FOSSGIS endpoints by default", () => {
    expect(osrmEndpointForMode("foot")).toEqual({
      baseUrl: "https://routing.openstreetmap.de/routed-foot",
      profile: "foot",
    });
    expect(osrmEndpointForMode("bike")).toEqual({
      baseUrl: "https://routing.openstreetmap.de/routed-bike",
      profile: "bike",
    });
    expect(osrmEndpointForMode("driving")).toEqual({
      baseUrl: "https://routing.openstreetmap.de/routed-car",
      profile: "car",
    });
    expect(osrmProfileForMode("driving")).toBe("car");
  });
});
