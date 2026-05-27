import { describe, expect, it } from "vitest";
import { viewHeadingFromOrientation } from "@/lib/device-orientation-ar";

/** Android portrait upright: one physical turn should advance heading ~360°, not ~720°. */
describe("device-orientation heading scale", () => {
  const beta = 0;
  const gamma = 0;
  const screen = 0;

  it("Android upright: heading tracks alpha 1:1", () => {
    const h0 = viewHeadingFromOrientation(0, beta, gamma, screen);
    const h90 = viewHeadingFromOrientation(90, beta, gamma, screen);
    const h180 = viewHeadingFromOrientation(180, beta, gamma, screen);
    const h360 = viewHeadingFromOrientation(360, beta, gamma, screen);

    expect(h0).toBeCloseTo(0, 0);
    expect(Math.abs(h90 - h0)).toBeCloseTo(90, 0);
    expect(Math.abs(h180 - h0)).toBeCloseTo(180, 0);
    expect(h360).toBeCloseTo(h0, 0);
  });

  it("iOS-style beta 90: still uses camera look (not raw alpha)", () => {
    const heading = viewHeadingFromOrientation(254.8, 83.2, -0.3, 0);
    expect(heading).toBeGreaterThan(280);
    expect(heading).toBeLessThan(290);
    expect(heading).not.toBeCloseTo(254.8, 0);
  });
});
