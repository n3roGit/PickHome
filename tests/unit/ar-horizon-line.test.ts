import { describe, expect, it } from "vitest";
import {
  computeHorizonLineInCanvas,
  intrinsicsFromFov,
} from "@/lib/ar-horizon-line";

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

  it("roll: horizon line is not horizontal", () => {
    const line = computeHorizonLineInCanvas(
      W,
      H,
      INTR,
      { x: 5, y: -8.5, z: 4.9 },
      0
    );
    expect(line).not.toBeNull();
    expect(Math.abs(line!.y1 - line!.y2)).toBeGreaterThan(40);
  });
});
