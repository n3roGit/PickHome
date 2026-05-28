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

/** Interpolate horizon canvas Y (downward) at pixel x. */
export function horizonYAtX(line: HorizonLineSegment, x: number, width: number): number {
  return line.y1 + ((line.y2 - line.y1) * x) / width;
}

/**
 * Camera pitch (deg) implied by the horizon line mid-Y — inverse of pitch-only fallback.
 * Matches gravity horizon geometry; stable near 0° unlike raw atan2(gravity).
 */
export function pitchDegFromHorizonMid(
  horizon: HorizonLineSegment,
  height: number,
  vFovDeg: number
): number {
  const midY = (horizon.y1 + horizon.y2) / 2;
  return ((midY - height / 2) / height) * vFovDeg;
}

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

/** Signed azimuth difference sun − camera heading, range (−180, 180]. */
export function azimuthDeltaDeg(
  sunAzimuthDeg: number,
  cameraHeadingDeg: number,
  yawOffsetDeg = 0
): number {
  let delta = sunAzimuthDeg - (cameraHeadingDeg + yawOffsetDeg);
  return ((delta + 540) % 360) - 180;
}

/** Smallest angle between two compass azimuths (0–180). */
export function azimuthSeparationDeg(aDeg: number, bDeg: number): number {
  return Math.abs(azimuthDeltaDeg(aDeg, bDeg, 0));
}

/** Unit normal pointing toward the sky, perpendicular to the horizon segment (canvas y down). */
export function skyNormalFromHorizon(horizon: HorizonLineSegment): { nx: number; ny: number } {
  const dx = horizon.x2 - horizon.x1;
  const dy = horizon.y2 - horizon.y1;
  let nx = -dy;
  let ny = dx;
  const len = Math.hypot(nx, ny) || 1;
  nx /= len;
  ny /= len;
  if (ny > 0) {
    nx = -nx;
    ny = -ny;
  }
  return { nx, ny };
}

/**
 * Project sun into the live preview anchored to the gravity horizon line.
 * Horizontal: pinhole tan(delta); vertical: lift along sky normal from horizon.
 */
export function projectSunOnHorizonToCanvas(
  width: number,
  height: number,
  horizon: HorizonLineSegment,
  sunAzimuthDeg: number,
  sunAltitudeDeg: number,
  cameraHeadingDeg: number,
  cameraPitchDeg: number,
  hFovDeg: number,
  vFovDeg: number,
  horizonMarginDeg = 12,
  yawOffsetDeg = 0
): { x: number; y: number } | null {
  const relAltDeg = sunAltitudeDeg - cameraPitchDeg;
  if (relAltDeg < -horizonMarginDeg) return null;

  const deltaDeg = azimuthDeltaDeg(sunAzimuthDeg, cameraHeadingDeg, yawOffsetDeg);

  const hFovRad = hFovDeg * DEG2RAD;
  const vFovRad = vFovDeg * DEG2RAD;
  const fx = width / (2 * Math.tan(hFovRad / 2));
  const fy = height / (2 * Math.tan(vFovRad / 2));
  const cx = width / 2;

  const deltaRad = deltaDeg * DEG2RAD;
  const relAltRad = relAltDeg * DEG2RAD;

  const maxDeltaRad = hFovRad / 2 + 5 * DEG2RAD;
  const maxAltRad = vFovRad / 2 + 5 * DEG2RAD;
  if (Math.abs(deltaRad) > maxDeltaRad) return null;
  if (relAltRad > maxAltRad) return null;

  const xOnHorizon = cx + fx * Math.tan(deltaRad);
  const yOnHorizon = horizonYAtX(horizon, xOnHorizon, width);

  const { nx, ny } = skyNormalFromHorizon(horizon);
  const lift = fy * Math.tan(relAltRad);

  const x = xOnHorizon + nx * lift;
  const y = yOnHorizon + ny * lift;

  if (x < -20 || x > width + 20 || y < -20 || y > height + 20) return null;
  return { x, y };
}

/**
 * Full 3D pinhole projection via device orientation (sensitive to compass yaw error).
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

export type SunArcAzimuthSample = {
  azimuthDeg: number;
  altitudeDeg: number;
};

/** Default pitch for README / ?demo=1 AR preview (level view toward horizon). */
export const PREVIEW_DEMO_PITCH_DEG = 4;

function horizonLineFromPitch(
  width: number,
  height: number,
  pitchDeg: number,
  vFovDeg: number
): HorizonLineSegment {
  const y = height / 2 + (pitchDeg / vFovDeg) * height;
  return { x1: 0, y1: y, x2: width, y2: y };
}

/**
 * Pick camera heading (and pitch) so many hourly sun markers fit in the horizontal FOV.
 * Used by AR preview demo (?demo=1) without a live compass.
 */
export function previewDemoViewFromSunArc(
  sunlitSamples: SunArcAzimuthSample[],
  canvasWidth: number,
  canvasHeight: number,
  options?: {
    hFovDeg?: number;
    vFovDeg?: number;
    horizonMarginDeg?: number;
    pitchDeg?: number;
  }
): { headingDeg: number; pitchDeg: number; visibleCount: number } {
  const hFovDeg = options?.hFovDeg ?? 50;
  const vFovDeg = options?.vFovDeg ?? 65;
  const horizonMarginDeg = options?.horizonMarginDeg ?? 12;
  const pitchDeg = options?.pitchDeg ?? PREVIEW_DEMO_PITCH_DEG;

  if (sunlitSamples.length === 0) {
    return { headingDeg: 90, pitchDeg, visibleCount: 0 };
  }

  const horizon = horizonLineFromPitch(canvasWidth, canvasHeight, pitchDeg, vFovDeg);
  let bestHeading = sunlitSamples[0]!.azimuthDeg;
  let bestCount = 0;

  for (const candidate of sunlitSamples) {
    const heading = candidate.azimuthDeg;
    let count = 0;
    for (const sample of sunlitSamples) {
      const pos = projectSunOnHorizonToCanvas(
        canvasWidth,
        canvasHeight,
        horizon,
        sample.azimuthDeg,
        sample.altitudeDeg,
        heading,
        pitchDeg,
        hFovDeg,
        vFovDeg,
        horizonMarginDeg
      );
      if (pos && pos.x >= 0 && pos.x <= canvasWidth) count++;
    }
    if (count > bestCount) {
      bestCount = count;
      bestHeading = heading;
    }
  }

  return { headingDeg: bestHeading, pitchDeg, visibleCount: bestCount };
}
