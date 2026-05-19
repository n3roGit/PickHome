import { describe, expect, it } from "vitest";
import {
  formatRouteDistance,
  formatRouteDuration,
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

describe("osrmProfileForMode", () => {
  it("maps travel modes to OSRM profiles", () => {
    expect(osrmProfileForMode("foot")).toBe("foot");
    expect(osrmProfileForMode("bike")).toBe("bike");
    expect(osrmProfileForMode("driving")).toBe("driving");
  });
});
