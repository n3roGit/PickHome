import { describe, expect, it } from "vitest";
import {
  DEFAULT_TRAVEL_MODE,
  parseTravelMode,
  travelModeLabel,
  TRAVEL_MODES,
} from "@/lib/travel-mode";

describe("parseTravelMode", () => {
  it("accepts valid modes", () => {
    expect(parseTravelMode("foot")).toBe("foot");
    expect(parseTravelMode("BIKE")).toBe("bike");
    expect(parseTravelMode(" driving ")).toBe("driving");
  });

  it("falls back to default", () => {
    expect(parseTravelMode("transit")).toBe(DEFAULT_TRAVEL_MODE);
    expect(parseTravelMode(null)).toBe(DEFAULT_TRAVEL_MODE);
  });
});

describe("travelModeLabel", () => {
  it("labels all modes", () => {
    for (const mode of TRAVEL_MODES) {
      expect(travelModeLabel(mode)).toBeTruthy();
    }
  });
});
