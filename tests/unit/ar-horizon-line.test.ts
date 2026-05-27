import { describe, expect, it } from "vitest";
import {
  computeHorizonLineInCanvas,
  deviceToCameraViewVector,
  horizonYAtX,
  intrinsicsFromFov,
  projectSunOnHorizonToCanvas,
  sunDirectionEarth,
} from "@/lib/ar-horizon-line";
import {
  cameraLookDirectionEarth,
  earthToDeviceDirection,
  viewHeadingFromOrientation,
  viewPitchFromOrientation,
} from "@/lib/device-orientation-ar";

const W = 390;
const H = 844;
const INTR = intrinsicsFromFov(W, H, 50, 65);

describe("ar-horizon-line", () => {
  it("upright portrait: horizon near vertical center", () => {
    const line = computeHorizonLineInCanvas(
      W,
      H,
      INTR,
      { x: 0, y: -9.8, z: 0.5 },
      0
    );
    expect(line).not.toBeNull();
    const midY = (line!.y1 + line!.y2) / 2;
    expect(midY).toBeGreaterThan(H * 0.4);
    expect(midY).toBeLessThan(H * 0.6);
    expect(Math.abs(line!.y1 - line!.y2)).toBeLessThan(8);
  });

  it("tilt ~45° down: horizon moves up in the image", () => {
    const level = computeHorizonLineInCanvas(W, H, INTR, { x: 0, y: -9.8, z: 0 }, 0);
    const down = computeHorizonLineInCanvas(
      W,
      H,
      INTR,
      { x: 0, y: -6.9, z: -6.9 },
      0
    );
    expect(level).not.toBeNull();
    expect(down).not.toBeNull();
    const levelMid = (level!.y1 + level!.y2) / 2;
    const downMid = (down!.y1 + down!.y2) / 2;
    expect(downMid).toBeLessThan(levelMid - 80);
  });

  it("tilt ~45° up: horizon moves down in the image", () => {
    const level = computeHorizonLineInCanvas(W, H, INTR, { x: 0, y: -9.8, z: 0 }, 0);
    const up = computeHorizonLineInCanvas(W, H, INTR, { x: 0, y: -6.9, z: 6.9 }, 0);
    expect(level).not.toBeNull();
    expect(up).not.toBeNull();
    const levelMid = (level!.y1 + level!.y2) / 2;
    const upMid = (up!.y1 + up!.y2) / 2;
    expect(upMid).toBeGreaterThan(levelMid + 80);
  });

  it("roll right (Android-style gravity -x): left side higher on screen", () => {
    const line = computeHorizonLineInCanvas(
      W,
      H,
      INTR,
      { x: -5, y: -8.5, z: 4.9 },
      0
    );
    expect(line).not.toBeNull();
    expect(Math.abs(line!.y1 - line!.y2)).toBeGreaterThan(40);
    expect(line!.y1).toBeLessThan(line!.y2);
  });

  it("roll left (Android-style gravity +x): right side higher on screen", () => {
    const line = computeHorizonLineInCanvas(
      W,
      H,
      INTR,
      { x: 5, y: -8.5, z: 4.9 },
      0
    );
    expect(line).not.toBeNull();
    expect(line!.y1).toBeGreaterThan(line!.y2);
  });

  it("camera look direction has positive depth in camera view", () => {
    const ori = { alpha: 286, beta: 0, gamma: 0, screenAngleDeg: 0 };
    const look = cameraLookDirectionEarth(ori.alpha, ori.beta, ori.gamma, ori.screenAngleDeg);
    const device = earthToDeviceDirection(
      look.east,
      look.north,
      look.up,
      ori.alpha,
      ori.beta,
      ori.gamma,
      ori.screenAngleDeg
    );
    const view = deviceToCameraViewVector(device);
    expect(view.z).toBeGreaterThan(0.1);
  });

  it("sun in camera look direction: near horizontal center on horizon", () => {
    const gravity = { x: 0, y: -9.8, z: 0.5 };
    const horizon = computeHorizonLineInCanvas(W, H, INTR, gravity, 0)!;
    const heading = viewHeadingFromOrientation(286, 0, 0, 0);
    const pitch = viewPitchFromOrientation(286, 0, 0, 0);
    const pos = projectSunOnHorizonToCanvas(
      W,
      H,
      horizon,
      heading,
      pitch,
      heading,
      pitch,
      50,
      65,
      12
    );
    expect(pos).not.toBeNull();
    expect(Math.abs(pos!.x - W / 2)).toBeLessThan(8);
    expect(Math.abs(pos!.y - horizonYAtX(horizon, pos!.x, W))).toBeLessThan(8);
  });

  it("sun at elevation 0 sits on gravity horizon line", () => {
    const gravity = { x: 0, y: -9.8, z: 0.2 };
    const horizon = computeHorizonLineInCanvas(W, H, INTR, gravity, 0)!;
    const heading = viewHeadingFromOrientation(36, 0, 0, 0);
    const pos = projectSunOnHorizonToCanvas(
      W,
      H,
      horizon,
      heading,
      0,
      heading,
      0,
      50,
      65,
      12
    );
    expect(pos).not.toBeNull();
    expect(Math.abs(pos!.y - horizonYAtX(horizon, pos!.x, W))).toBeLessThan(2);
  });
});
