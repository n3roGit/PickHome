/**
 * AR view angles from DeviceOrientation (W3C Device Orientation spec).
 * Device held vertically in portrait; back camera looks along -Z in device frame.
 * @see https://www.w3.org/TR/orientation-event/
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Device_orientation_events/Detecting_device_orientation
 */

import {
  isScreenHorizontalFromGravity,
  mergePitchReadings,
  pitchFromGravity,
  pitchFromOrientation,
} from "@/lib/device-pitch";

/** If |pitch| exceeds this, the user is holding the phone for AR (not flat on a table). */
const AR_FLAT_MAX_TILT_DEG = 15;

/** Table-flat gravity pitch is ~±90°; AR look up/down is typically within ±75°. */
function isArTiltPitch(pitch: number | null): boolean {
  if (pitch == null || Number.isNaN(pitch)) return false;
  const a = Math.abs(pitch);
  return a > AR_FLAT_MAX_TILT_DEG && a < 75;
}

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

export function earthFrameMatrix(
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

/** Unit direction in device frame from East-North-Up (W3C earth frame). */
export function earthToDeviceDirection(
  east: number,
  north: number,
  up: number,
  alpha: number,
  beta: number,
  gamma: number,
  screenAngleDeg: number
): { x: number; y: number; z: number } {
  const m = earthFrameMatrix(alpha, beta, gamma, screenAngleDeg);
  return {
    x: m[0] * east + m[3] * north + m[6] * up,
    y: m[1] * east + m[4] * north + m[7] * up,
    z: m[2] * east + m[5] * north + m[8] * up,
  };
}

/** Unit look direction in W3C earth frame (X east, Y north, Z up). */
export function cameraLookDirectionEarth(
  alpha: number,
  beta: number,
  gamma: number,
  screenAngleDeg: number
): { east: number; north: number; up: number } {
  const { dx, dy, dz } = cameraLookVector(alpha, beta, gamma, screenAngleDeg);
  const mag = Math.hypot(dx, dy, dz);
  if (mag < 1e-6) return { east: 0, north: 0, up: 1 };
  return { east: dx / mag, north: dy / mag, up: dz / mag };
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

export type DeviceOrientationHeadingInput = {
  alpha: number;
  beta: number;
  gamma: number;
  screenAngleDeg: number;
  absolute?: boolean;
  webkitCompassHeading?: number | null;
};

/**
 * Compass heading for AR yaw (direction the rear camera points, degrees from north).
 * iOS: prefer webkitCompassHeading. Android portrait (beta≈0): normalized look vector
 * spins twice per turn; use W3C alpha with screen compensation when absolute.
 */
export function viewHeadingFromOrientation(
  alpha: number,
  beta: number,
  gamma: number,
  screenAngleDeg: number,
  options?: { absolute?: boolean; webkitCompassHeading?: number | null }
): number {
  const compass = options?.webkitCompassHeading;
  if (compass != null && !Number.isNaN(compass)) {
    return normalizeScreenAngle(compass);
  }

  const screen = normalizeScreenAngle(screenAngleDeg);

  if (Math.abs(beta) < 45) {
    if (options?.absolute) {
      return normalizeScreenAngle(360 - alpha - screen);
    }
    return normalizeScreenAngle(alpha - screen);
  }

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

function resolveArPitch(
  alpha: number,
  beta: number,
  gamma: number,
  screenAngleDeg: number,
  gravity: GravitySample | null
): number {
  const orientPitch = pitchFromOrientation(beta, gamma, screenAngleDeg);
  const gravityPitch =
    gravity != null
      ? pitchFromGravity(gravity.x, gravity.y, gravity.z, screenAngleDeg)
      : null;
  // Android portrait upright uses beta≈0; tilt is in gravity, not beta.
  if (Math.abs(beta) < 45 && gravityPitch != null) {
    return gravityPitch;
  }
  const merged = mergePitchReadings(orientPitch, gravityPitch);
  if (merged != null) return merged;
  return viewPitchFromOrientation(alpha, beta, gamma, screenAngleDeg);
}

export function viewOrientationFromEvent(
  alpha: number | null,
  beta: number | null,
  gamma: number | null,
  screenAngleDeg: number,
  gravity?: GravitySample | null,
  headingOptions?: Pick<DeviceOrientationHeadingInput, "absolute" | "webkitCompassHeading">
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

  const orientPitch = pitchFromOrientation(beta, gamma, screenAngleDeg);
  const gravityPitch =
    gravity != null
      ? pitchFromGravity(gravity.x, gravity.y, gravity.z, screenAngleDeg)
      : null;

  if (
    gravity != null &&
    isScreenHorizontalFromGravity(gravity.x, gravity.y, gravity.z, screenAngleDeg) &&
    !isArTiltPitch(orientPitch) &&
    !isArTiltPitch(gravityPitch)
  ) {
    return { heading: null, pitch: null, flat: true };
  }

  const pitch = resolveArPitch(alpha, beta, gamma, screenAngleDeg, gravity ?? null);

  return {
    heading: viewHeadingFromOrientation(alpha, beta, gamma, screenAngleDeg, headingOptions),
    pitch,
    flat: false,
  };
}

export function webkitCompassHeadingFromEvent(
  event: DeviceOrientationEvent
): number | null {
  const h = event.webkitCompassHeading;
  return typeof h === "number" && !Number.isNaN(h) ? h : null;
}

/** Heading from a live DeviceOrientationEvent (absolute flag + iOS compass). */
export function viewHeadingFromDeviceOrientationEvent(
  alpha: number,
  beta: number,
  gamma: number,
  screenAngleDeg: number,
  event: DeviceOrientationEvent
): number {
  return viewHeadingFromOrientation(alpha, beta, gamma, screenAngleDeg, {
    absolute: event.absolute === true,
    webkitCompassHeading: webkitCompassHeadingFromEvent(event),
  });
}
