import { describe, expect, it } from "vitest";
import {
  normalizeBetaForVerticalAr,
  viewHeadingFromOrientation,
  viewOrientationFromEvent,
  viewPitchFromOrientation,
} from "@/lib/device-orientation-ar";

describe("device-orientation-ar", () => {
  it("normalizeBetaForVerticalAr maps Android upright beta 0 to W3C 90", () => {
    expect(normalizeBetaForVerticalAr(0)).toBe(90);
    expect(normalizeBetaForVerticalAr(90)).toBe(90);
  });

  it("vertical hold (W3C beta=90): pitch near horizon", () => {
    expect(Math.abs(viewPitchFromOrientation(0, 90, 0, 0))).toBeLessThan(8);
  });

  it("Android-style vertical (beta=0): pitch near horizon", () => {
    expect(Math.abs(viewPitchFromOrientation(0, 0, 0, 0))).toBeLessThan(8);
  });

  it("tilt top back (beta 90→60): positive pitch toward sky", () => {
    const pitch = viewPitchFromOrientation(0, 60, 0, 0);
    expect(pitch).toBeGreaterThan(15);
    expect(pitch).toBeLessThan(40);
  });

  it("tilt top forward (beta 90→120): negative pitch toward ground", () => {
    const pitch = viewPitchFromOrientation(0, 120, 0, 0);
    expect(pitch).toBeLessThan(-15);
    expect(pitch).toBeGreaterThan(-40);
  });

  it("camera heading follows alpha when vertical (iOS and Android beta)", () => {
    const h0 = viewHeadingFromOrientation(0, 90, 0, 0);
    const h90 = viewHeadingFromOrientation(90, 0, 0, 0);
    expect(Math.abs(h90 - h0)).toBeGreaterThan(45);
  });

  it("portrait vertical: heading uses camera look vector, not raw alpha", () => {
    const heading = viewHeadingFromOrientation(254.8, 83.2, -0.3, 0);
    expect(heading).toBeGreaterThan(280);
    expect(heading).toBeLessThan(290);
    expect(heading).not.toBeCloseTo(254.8, 0);
  });

  it("viewOrientationFromEvent returns null for missing values", () => {
    expect(viewOrientationFromEvent(null, 90, 0, 0)).toBeNull();
  });

  it("flat on table (gravity in Z): no heading/pitch, flat flag", () => {
    const flatGravity = { x: -0.1, y: -0.1, z: 9.8 };
    const view = viewOrientationFromEvent(256.2, -0.4, 0.3, 0, flatGravity);
    expect(view?.flat).toBe(true);
    expect(view?.heading).toBeNull();
    expect(view?.pitch).toBeNull();
  });

  it("upright portrait (Android beta≈0 + gravity): heading and pitch for AR", () => {
    const uprightGravity = { x: 0.2, y: -9.7, z: 0.8 };
    const view = viewOrientationFromEvent(254.8, 0, -0.3, 0, uprightGravity);
    expect(view?.flat).toBe(false);
    expect(view?.heading).toBeGreaterThan(280);
    expect(view?.heading).toBeLessThan(292);
    expect(Math.abs(view?.pitch ?? 99)).toBeLessThan(12);
  });

  it("AR tilt ~45° down: not flat (guards old gravity threshold on 1.3.39)", () => {
    const tiltGravity = { x: 0, y: -6.9, z: -6.9 };
    const view = viewOrientationFromEvent(36, 0, 0, 0, tiltGravity);
    expect(view?.flat).toBe(false);
    expect(view?.pitch).toBeLessThan(-35);
    expect(view?.pitch).toBeGreaterThan(-55);
  });

  it("AR tilt ~45° up: not flat", () => {
    const tiltGravity = { x: 0, y: -6.9, z: 6.9 };
    const view = viewOrientationFromEvent(36, 0, 0, 0, tiltGravity);
    expect(view?.flat).toBe(false);
    expect(view?.pitch).toBeGreaterThan(35);
    expect(view?.pitch).toBeLessThan(55);
  });
});
