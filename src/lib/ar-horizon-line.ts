/**
 * Mathematical horizon line in the camera preview (vanishing line of the horizontal plane).
 * Uses gravity in screen space + pinhole intrinsics; yaw/compass is not required.
 */

import { gravityInScreenFrame } from "@/lib/device-pitch";
import type { GravitySample } from "@/lib/device-orientation-ar";

export type PinholeIntrinsics = {
  fx: number;
  fy: number;
  cx: number;
  cy: number;
};

export type HorizonLineSegment = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

/** Focal lengths in pixels from horizontal/vertical FOV (degrees). */
export function intrinsicsFromFov(
  width: number,
  height: number,
  hFovDeg: number,
  vFovDeg: number
): PinholeIntrinsics {
  const hRad = (hFovDeg * Math.PI) / 180;
  const vRad = (vFovDeg * Math.PI) / 180;
  return {
    fx: width / (2 * Math.tan(hRad / 2)),
    fy: height / (2 * Math.tan(vRad / 2)),
    cx: width / 2,
    cy: height / 2,
  };
}

/** Sky direction in camera coords (x right, y up, z into scene). */
export function upVectorInCameraFrame(
  gravity: GravitySample,
  screenAngleDeg: number
): { x: number; y: number; z: number } | null {
  const g = gravityInScreenFrame(gravity.x, gravity.y, gravity.z, screenAngleDeg);
  const mag = Math.hypot(g.x, g.y, g.z);
  if (mag < 2) return null;
  // Screen/device Y points toward top of phone; canvas Y points down → flip for camera y-up.
  // Negate X so roll (tilt left/right) matches the rear-camera preview (was inverted on Android).
  return {
    x: -g.x / mag,
    y: -g.y / mag,
    z: g.z / mag,
  };
}

/**
 * Horizon segment across the preview width in canvas pixels (y downward).
 * Returns null if the line is nearly vertical or gravity is unavailable.
 */
export function computeHorizonLineInCanvas(
  width: number,
  height: number,
  intrinsics: PinholeIntrinsics,
  gravity: GravitySample,
  screenAngleDeg: number
): HorizonLineSegment | null {
  const up = upVectorInCameraFrame(gravity, screenAngleDeg);
  if (!up) return null;

  const { fx, fy, cx, cy } = intrinsics;
  const cyUp = height - cy;

  const a = up.x / fx;
  const b = up.y / fy;
  const c = up.z - (up.x * cx) / fx - (up.y * cyUp) / fy;

  if (Math.abs(b) < 1e-5) return null;

  const vUpLeft = -(a * 0 + c) / b;
  const vUpRight = -(a * width + c) / b;

  return {
    x1: 0,
    y1: height - vUpLeft,
    x2: width,
    y2: height - vUpRight,
  };
}
