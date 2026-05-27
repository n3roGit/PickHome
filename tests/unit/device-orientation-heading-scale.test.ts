import { describe, expect, it } from "vitest";
import {
  isPortraitArOrientation,
  viewHeadingFromCameraLook,
  viewHeadingFromOrientation,
} from "@/lib/device-orientation-ar";

function absSweep(headingAtAlpha: (alpha: number) => number): number {
  const steps = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330, 360].map(
    headingAtAlpha
  );
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
  it("isPortraitArOrientation covers Android beta 0 and iOS beta 90", () => {
    expect(isPortraitArOrientation(0)).toBe(true);
    expect(isPortraitArOrientation(85)).toBe(true);
    expect(isPortraitArOrientation(50)).toBe(false);
  });

  it("portrait heading (beta 0 and 90): one alpha cycle → 360° sweep", () => {
    for (const beta of [0, 85, 90]) {
      const sweep = absSweep((a) =>
        viewHeadingFromOrientation(a, beta, 0, 0, { absolute: true })
      );
      expect(sweep).toBeGreaterThan(350);
      expect(sweep).toBeLessThan(370);
    }
  });

  it("camera look (no extra branches): one alpha cycle → 360° sweep at beta 90", () => {
    const sweep = absSweep((a) => viewHeadingFromCameraLook(a, 90, 0, 0));
    expect(sweep).toBeGreaterThan(350);
    expect(sweep).toBeLessThan(370);
  });

  it("heading direction: alpha 90 → west (270°), alpha 270 → east (90°)", () => {
    expect(viewHeadingFromOrientation(0, 85, 0, 0, { absolute: true })).toBeCloseTo(0, 0);
    expect(viewHeadingFromOrientation(90, 85, 0, 0, { absolute: true })).toBeCloseTo(270, 0);
    expect(viewHeadingFromOrientation(180, 85, 0, 0, { absolute: true })).toBeCloseTo(180, 0);
    expect(viewHeadingFromOrientation(270, 85, 0, 0, { absolute: true })).toBeCloseTo(90, 0);
  });

  it("prefers webkitCompassHeading (iOS)", () => {
    expect(
      viewHeadingFromOrientation(10, 83, 0, 0, { webkitCompassHeading: 287.5 })
    ).toBeCloseTo(287.5, 1);
  });
});
