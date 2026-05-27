import { describe, expect, it } from "vitest";
import {
  isPortraitArOrientation,
  viewHeadingFromCameraLook,
  viewHeadingFromOrientation,
} from "@/lib/device-orientation-ar";

function totalAbsSweep(headingAtAlpha: (alpha: number) => number): number {
  const steps = [0, 45, 90, 135, 180, 225, 270, 315, 360].map(headingAtAlpha);
  let sum = 0;
  for (let i = 1; i < steps.length; i++) {
    let d = steps[i]! - steps[i - 1]!;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    sum += Math.abs(d);
  }
  return sum;
}

describe("device-orientation heading scale", () => {
  const gamma = 0;
  const screen = 0;

  it("isPortraitArOrientation covers Android beta 0 and iOS beta 90", () => {
    expect(isPortraitArOrientation(0)).toBe(true);
    expect(isPortraitArOrientation(90)).toBe(true);
    expect(isPortraitArOrientation(83)).toBe(true);
    expect(isPortraitArOrientation(50)).toBe(false);
  });

  it("portrait uses alpha: ~360° abs sweep per alpha cycle (beta 0 and 90)", () => {
    for (const beta of [0, 90]) {
      const sweep = totalAbsSweep((a) =>
        viewHeadingFromOrientation(a, beta, gamma, screen, { absolute: true })
      );
      expect(sweep).toBeGreaterThan(300);
      expect(sweep).toBeLessThan(420);
    }
  });

  it("camera look at beta 0: ~720° abs sweep per alpha cycle (2× — avoided in AR)", () => {
    const sweep = totalAbsSweep((a) => viewHeadingFromCameraLook(a, 0, gamma, screen));
    expect(sweep).toBeGreaterThan(500);
  });

  it("prefers webkitCompassHeading when provided (iOS)", () => {
    expect(
      viewHeadingFromOrientation(10, 83, 0, 0, { webkitCompassHeading: 287.5 })
    ).toBeCloseTo(287.5, 1);
  });
});
