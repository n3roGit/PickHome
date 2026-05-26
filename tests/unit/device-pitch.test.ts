import { describe, expect, it } from "vitest";
import { pitchFromGravity, pitchFromOrientation } from "@/lib/device-pitch";

describe("device-pitch", () => {
  it("portrait iOS upright: beta 90 → horizon pitch 0", () => {
    expect(pitchFromOrientation(90, 0, 0)).toBe(0);
  });

  it("portrait Android upright: beta 0 → horizon pitch 0", () => {
    expect(pitchFromOrientation(0, 0, 0)).toBeCloseTo(0);
  });

  it("portrait iOS tilted toward sky: beta 60 → positive pitch", () => {
    expect(pitchFromOrientation(60, 0, 0)).toBe(30);
  });

  it("portrait Android tilted toward sky: beta -30 → positive pitch", () => {
    expect(pitchFromOrientation(-30, 0, 0)).toBe(30);
  });

  it("pitchFromGravity is near 0 when gravity pulls along device Y", () => {
    const pitch = pitchFromGravity(0, -9.8, 0, 0);
    expect(Math.abs(pitch)).toBeLessThan(10);
  });
});
