/**
 * AR view angles from DeviceOrientation (W3C Device Orientation spec).
 * Device held vertically in portrait; back camera looks along -Z in device frame.
 * @see https://www.w3.org/TR/orientation-event/
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Device_orientation_events/Detecting_device_orientation
 */

import { isScreenHorizontalFromGravity } from "@/lib/device-pitch";

const DEG2RAD = Math.PI / 180;

export type GravitySample = {
  x: number;
  y: number;
  z: number;
};

export function normalizeScreenAngle(angle: number): number {
  return ((angle % 360) + 360) % 360;
}

/** W3C rotation matrix (device → Earth frame), Z-X'-Y'' Tait-Bryan. */
export function getRotationMatrix(alpha: number, beta: number, gamma: number): number[] {
  const _x = beta * DEG2RAD;
  const _y = gamma * DEG2RAD;
  const _z = alpha * DEG2RAD;

  const cX = Math.cos(_x);
  const cY = Math.cos(_y);
  const cZ = Math.cos(_z);
  const sX = Math.sin(_x);
  const sY = Math.sin(_y);
  const sZ = Math.sin(_z);

  return [
    cZ * cY - sZ * sX * sY,
    -cX * sZ,
    cY * sZ * sX + cZ * sY,
    cY * sZ + cZ * sX * sY,
    cZ * cX,
    sZ * sY - cZ * cY * sX,
    -cX * sY,
    sX,
    cX * cY,
  ];
}

export function multiplyMat3(a: number[], b: number[]): number[] {
  const out = new Array<number>(9);
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      out[row * 3 + col] =
        a[row * 3] * b[col] +
        a[row * 3 + 1] * b[3 + col] +
        a[row * 3 + 2] * b[6 + col];
    }
  }
  return out;
}

export function mat3RotateZ(deg: number): number[] {
  const r = deg * DEG2RAD;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [c, s, 0, -s, c, 0, 0, 0, 1];
}

/**
 * Map device beta to W3C portrait-vertical frame (beta ≈ 90 when held for AR).
 * iOS reports ~90 upright; Android/Chrome often ~0 upright.
 */
export function normalizeBetaForVerticalAr(beta: number): number {
  if (Math.abs(beta) < 45) {
    return 90 + beta;
  }
  return beta;
}

function earthFrameMatrix(
  alpha: number,
  beta: number,
  gamma: number,
  screenAngleDeg: number
): number[] {
  const b = normalizeBetaForVerticalAr(beta);
  const r = getRotationMatrix(alpha, b, gamma);
  const rs = mat3RotateZ(-normalizeScreenAngle(screenAngleDeg));
  return multiplyMat3(rs, r);
}

/** Rear-camera look vector in Earth frame (horizontal dx/dy, vertical dz). */
function cameraLookVector(
  alpha: number,
  beta: number,
  gamma: number,
  screenAngleDeg: number
): { dx: number; dy: number; dz: number } {
  const m = earthFrameMatrix(alpha, beta, gamma, screenAngleDeg);
  return { dx: -m[2], dy: -m[5], dz: -m[8] };
}

/** Compass heading from rear-camera look vector (always matrix-based). */
export function viewHeadingFromCameraLook(
  alpha: number,
  beta: number,
  gamma: number,
  screenAngleDeg: number
): number {
  const { dx, dy } = cameraLookVector(alpha, beta, gamma, screenAngleDeg);

  let heading = Math.atan2(dx, dy);
  if (dy < 0) heading += Math.PI;
  else if (dx < 0) heading += 2 * Math.PI;

  return (heading * 180) / Math.PI;
}

export function viewHeadingFromOrientation(
  alpha: number,
  beta: number,
  gamma: number,
  screenAngleDeg: number
): number {
  return viewHeadingFromCameraLook(alpha, beta, gamma, screenAngleDeg);
}

/** @deprecated Use viewHeadingFromOrientation; kept for tests comparing W3C top-edge formula. */
export function compassHeadingFromOrientation(
  alpha: number,
  beta: number,
  gamma: number
): number {
  const b = normalizeBetaForVerticalAr(beta);
  const _x = b * DEG2RAD;
  const _y = gamma * DEG2RAD;
  const _z = alpha * DEG2RAD;

  const cX = Math.cos(_x);
  const cY = Math.cos(_y);
  const cZ = Math.cos(_z);
  const sX = Math.sin(_x);
  const sY = Math.sin(_y);
  const sZ = Math.sin(_z);

  const vx = -cZ * sY - sZ * sX * cY;
  const vy = -sZ * sY + cZ * sX * cY;

  let heading = Math.atan2(vx, vy);
  if (vy < 0) heading += Math.PI;
  else if (vx < 0) heading += 2 * Math.PI;

  return (heading * 180) / Math.PI;
}

/**
 * Camera elevation: 0° = level at horizon, positive = toward sky.
 */
export function viewPitchFromOrientation(
  alpha: number,
  beta: number,
  gamma: number,
  screenAngleDeg: number
): number {
  const { dx, dy, dz } = cameraLookVector(alpha, beta, gamma, screenAngleDeg);
  const horizontal = Math.hypot(dx, dy);
  return (Math.atan2(-dz, horizontal) * 180) / Math.PI;
}

export type ArViewOrientation = {
  heading: number | null;
  pitch: number | null;
  /** Phone flat on a surface — AR sun projection is not meaningful. */
  flat: boolean;
};

export function viewOrientationFromEvent(
  alpha: number | null,
  beta: number | null,
  gamma: number | null,
  screenAngleDeg: number,
  gravity?: GravitySample | null
): ArViewOrientation | null {
  if (
    alpha == null ||
    beta == null ||
    gamma == null ||
    Number.isNaN(alpha) ||
    Number.isNaN(beta) ||
    Number.isNaN(gamma)
  ) {
    return null;
  }

  if (
    gravity != null &&
    isScreenHorizontalFromGravity(gravity.x, gravity.y, gravity.z, screenAngleDeg)
  ) {
    return { heading: null, pitch: null, flat: true };
  }

  return {
    heading: viewHeadingFromOrientation(alpha, beta, gamma, screenAngleDeg),
    pitch: viewPitchFromOrientation(alpha, beta, gamma, screenAngleDeg),
    flat: false,
  };
}
