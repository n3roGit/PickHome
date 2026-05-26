import { describe, expect, it } from "vitest";
import {
  compassFromAzimuth,
  destinationPoint,
  getSolarArc,
  getSolarDayTimes,
  getSolarSample,
} from "@/lib/solar-position";

const BERLIN_LAT = 52.52;
const BERLIN_LNG = 13.405;

describe("solar-position", () => {
  it("Berlin summer solar noon: high sun, roughly south", () => {
    const day = new Date("2025-06-21T12:00:00.000Z");
    const { solarNoon } = getSolarDayTimes(day, BERLIN_LAT, BERLIN_LNG);
    expect(solarNoon).not.toBeNull();
    const sample = getSolarSample(solarNoon!, BERLIN_LAT, BERLIN_LNG);
    expect(sample.altitudeDeg).toBeGreaterThan(55);
    expect(sample.azimuthDeg).toBeGreaterThan(160);
    expect(sample.azimuthDeg).toBeLessThan(200);
    expect(sample.isUp).toBe(true);
  });

  it("Berlin winter solstice night: sun below horizon", () => {
    const sample = getSolarSample(new Date("2025-12-21T03:00:00.000Z"), BERLIN_LAT, BERLIN_LNG);
    expect(sample.isUp).toBe(false);
    expect(sample.altitudeDeg).toBeLessThanOrEqual(0);
  });

  it("compassFromAzimuth maps cardinal directions", () => {
    expect(compassFromAzimuth(0)).toBe("N");
    expect(compassFromAzimuth(90)).toBe("O");
    expect(compassFromAzimuth(180)).toBe("S");
    expect(compassFromAzimuth(270)).toBe("W");
  });

  it("getSolarArc returns ascending timestamps with 60-min step", () => {
    const arc = getSolarArc(new Date("2025-06-21T12:00:00.000Z"), BERLIN_LAT, BERLIN_LNG, 60);
    expect(arc).toHaveLength(24);
    for (let i = 1; i < arc.length; i++) {
      expect(arc[i]!.date.getTime()).toBeGreaterThan(arc[i - 1]!.date.getTime());
    }
  });

  it("destinationPoint moves north when bearing is 0", () => {
    const dest = destinationPoint(BERLIN_LAT, BERLIN_LNG, 0, 1000);
    expect(dest.lat).toBeGreaterThan(BERLIN_LAT);
    expect(dest.lng).toBeCloseTo(BERLIN_LNG, 2);
  });
});
