import { describe, expect, it } from "vitest";
import {
  compassHeadingFromOrientation,
  viewOrientationFromEvent,
  viewPitchFromOrientation,
} from "@/lib/device-orientation-ar";

describe("device-orientation-ar", () => {
  it("vertical hold (W3C beta=90): pitch near horizon", () => {
    const pitch = viewPitchFromOrientation(0, 90, 0, 0);
    expect(Math.abs(pitch)).toBeLessThan(8);
  });

  it("tilt top back (beta 90→45): positive pitch toward sky", () => {
    const pitch = viewPitchFromOrientation(0, 45, 0, 0);
    expect(pitch).toBeGreaterThan(15);
    expect(pitch).toBeLessThan(50);
  });

  it("tilt top forward (beta 90→135): negative pitch toward ground", () => {
    const pitch = viewPitchFromOrientation(0, 135, 0, 0);
    expect(pitch).toBeLessThan(-15);
    expect(pitch).toBeGreaterThan(-50);
  });

  it("compass heading follows alpha when vertical", () => {
    const h0 = compassHeadingFromOrientation(0, 90, 0);
    const h90 = compassHeadingFromOrientation(90, 90, 0);
    expect(Math.abs(h90 - h0)).toBeGreaterThan(45);
  });

  it("viewOrientationFromEvent returns null for missing values", () => {
    expect(viewOrientationFromEvent(null, 90, 0, 0)).toBeNull();
  });
});
