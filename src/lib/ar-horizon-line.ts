/**
 * Mathematical horizon line in the camera preview (vanishing line of the horizontal plane).
 * Uses gravity in screen space + pinhole intrinsics; yaw/compass is not required.
 */

import { gravityInScreenFrame } from "@/lib/device-pitch";
import {
  cameraLookDirectionEarth,
  earthToDeviceDirection,
  type GravitySample,
} from "@/lib/device-orientation-ar";

const DEG2RAD = Math.PI / 180;

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

/** Sun direction in W3C earth frame (X east, Y north, Z up). */
export function sunDirectionEarth(azimuthDeg: number, altitudeDeg: number): {
  east: number;
  north: number;
  up: number;
} {
  const az = azimuthDeg * DEG2RAD;
  const alt = altitudeDeg * DEG2RAD;
  const cosAlt = Math.cos(alt);
  return {
    east: Math.sin(az) * cosAlt,
    north: Math.cos(az) * cosAlt,
    up: Math.sin(alt),
  };
}

/** Camera view axes (x right, y up, z into scene) — matches horizon up-vector mapping. */
export function deviceToCameraViewVector(device: { x: number; y: number; z: number }): {
  x: number;
  y: number;
  z: number;
} {
  // Same screen/canvas mapping as gravity → up; rear camera looks along −device Z → +view Z.
  return { x: -device.x, y: -device.y, z: -device.z };
}

function projectCameraViewToCanvas(
  view: { x: number; y: number; z: number },
  width: number,
  height: number,
  intrinsics: PinholeIntrinsics
): { x: number; y: number } | null {
  if (view.z <= 0.02) return null;

  const { fx, fy, cx, cy } = intrinsics;
  const cyUp = height - cy;
  const u = cx + (fx * view.x) / view.z;
  const vUp = cyUp + (fy * view.y) / view.z;
  return { x: u, y: height - vUp };
}

function angleBetweenDeg(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number }
): number {
  const magA = Math.hypot(a.x, a.y, a.z);
  const magB = Math.hypot(b.x, b.y, b.z);
  if (magA < 1e-6 || magB < 1e-6) return 180;
  const dot = (a.x * b.x + a.y * b.y + a.z * b.z) / (magA * magB);
  return (Math.acos(Math.max(-1, Math.min(1, dot))) * 180) / Math.PI;
}

export type ArOrientationAngles = {
  alpha: number;
  beta: number;
  gamma: number;
  screenAngleDeg: number;
};

/**
 * Project sun position into canvas pixels using the same frame as the horizon line.
 */
export function projectSunToCanvas(
  width: number,
  height: number,
  intrinsics: PinholeIntrinsics,
  azimuthDeg: number,
  altitudeDeg: number,
  orientation: ArOrientationAngles,
  hFovDeg: number,
  vFovDeg: number,
  horizonMarginDeg = 12
): { x: number; y: number } | null {
  if (altitudeDeg < -horizonMarginDeg) return null;

  const sunEarth = sunDirectionEarth(azimuthDeg, altitudeDeg);

  const { alpha, beta, gamma, screenAngleDeg } = orientation;
  const lookEarth = cameraLookDirectionEarth(alpha, beta, gamma, screenAngleDeg);
  const sunDevice = earthToDeviceDirection(
    sunEarth.east,
    sunEarth.north,
    sunEarth.up,
    alpha,
    beta,
    gamma,
    screenAngleDeg
  );
  const lookDevice = earthToDeviceDirection(
    lookEarth.east,
    lookEarth.north,
    lookEarth.up,
    alpha,
    beta,
    gamma,
    screenAngleDeg
  );

  const sunView = deviceToCameraViewVector(sunDevice);
  const lookView = deviceToCameraViewVector(lookDevice);

  const sep = angleBetweenDeg(lookView, sunView);
  const maxAngle = Math.hypot(hFovDeg / 2, vFovDeg / 2) + 4;
  if (sep > maxAngle) return null;

  return projectCameraViewToCanvas(sunView, width, height, intrinsics);
}
