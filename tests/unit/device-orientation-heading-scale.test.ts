import { describe, expect, it } from "vitest";
import { viewHeadingFromOrientation } from "@/lib/device-orientation-ar";

/** Android portrait upright: one physical turn should advance heading ~360°, not ~720°. */
describe("device-orientation heading scale", () => {
  const beta = 0;
  const gamma = 0;
  const screen = 0;

  function totalSweep(absolute: boolean): number {
    const steps = [0, 45, 90, 135, 180, 225, 270, 315, 360].map((a) =>
      viewHeadingFromOrientation(a, beta, gamma, screen, { absolute })
    );
    let sum = 0;
    for (let i = 1; i < steps.length; i++) {
      let d = steps[i]! - steps[i - 1]!;
      if (d > 180) d -= 360;
      if (d < -180) d += 360;
      sum += d;
    }
    return sum;
  }

  it("Android absolute: one alpha cycle sweeps ~360° heading", () => {
    expect(Math.abs(totalSweep(true))).toBeGreaterThan(300);
    expect(Math.abs(totalSweep(true))).toBeLessThan(420);
  });

  it("prefers webkitCompassHeading when provided (iOS)", () => {
    expect(
      viewHeadingFromOrientation(10, 83, 0, 0, { webkitCompassHeading: 287.5 })
    ).toBeCloseTo(287.5, 1);
  });

  it("iOS-style beta 90: uses camera look (not raw alpha)", () => {
    const heading = viewHeadingFromOrientation(254.8, 83.2, -0.3, 0);
    expect(heading).toBeGreaterThan(280);
    expect(heading).toBeLessThan(290);
    expect(heading).not.toBeCloseTo(254.8, 0);
  });
});
