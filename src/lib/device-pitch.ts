/**
 * Camera elevation from device sensors: 0° = level at horizon, positive = toward sky.
 * DeviceOrientation beta conventions differ between iOS (~90° when upright) and Android (~0°).
 */

export function normalizeScreenAngle(angle: number): number {
  return ((angle % 360) + 360) % 360;
}

export function pitchFromOrientation(
  beta: number | null,
  gamma: number | null,
  screenAngleDeg: number
): number | null {
  if (beta == null || Number.isNaN(beta)) return null;
  const norm = normalizeScreenAngle(screenAngleDeg);

  if (norm === 90) {
    if (gamma == null || Number.isNaN(gamma)) return null;
    return 90 - gamma;
  }
  if (norm === 270) {
    if (gamma == null || Number.isNaN(gamma)) return null;
    return gamma - 90;
  }
  if (norm === 180) {
    return beta - 90;
  }
  // Portrait: iOS upright ~beta 90, Android upright ~beta 0
  if (Math.abs(beta) > 45) {
    return 90 - beta;
  }
  return -beta;
}

/** Pitch from gravity vector (m/s²), screen-adjusted. */
export function pitchFromGravity(
  x: number,
  y: number,
  z: number,
  screenAngleDeg: number
): number {
  let gx = x;
  let gy = y;
  let gz = z;
  const norm = normalizeScreenAngle(screenAngleDeg);

  if (norm === 90) {
    gx = y;
    gy = -x;
  } else if (norm === 270) {
    gx = -y;
    gy = x;
  } else if (norm === 180) {
    gy = -y;
    gz = -z;
  }

  return (Math.atan2(gx, Math.hypot(gy, gz)) * 180) / Math.PI;
}

export function mergePitchReadings(orientationPitch: number | null, gravityPitch: number | null): number | null {
  if (orientationPitch != null && gravityPitch != null) {
    return orientationPitch * 0.4 + gravityPitch * 0.6;
  }
  return gravityPitch ?? orientationPitch;
}
