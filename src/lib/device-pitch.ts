/**
 * Camera elevation from device sensors: 0° = level at horizon, positive = toward sky.
 * DeviceOrientation beta conventions differ between iOS (~90° when upright) and Android (~0°).
 */

export function normalizeScreenAngle(angle: number): number {
  return ((angle % 360) + 360) % 360;
}

/** Device gravity (m/s²) in the current screen coordinate frame. */
export function gravityInScreenFrame(
  x: number,
  y: number,
  z: number,
  screenAngleDeg: number
): { x: number; y: number; z: number } {
  const norm = normalizeScreenAngle(screenAngleDeg);

  if (norm === 90) {
    return { x: y, y: -x, z };
  }
  if (norm === 270) {
    return { x: -y, y: x, z };
  }
  if (norm === 180) {
    return { x: -x, y: -y, z: -z };
  }
  return { x, y, z };
}

/**
 * Screen roughly horizontal (face up or face down). Android beta ≈ 0 means both
 * flat-on-table and upright portrait — gravity disambiguates.
 *
 * Flat means the screen normal (Z) is within ~25° of vertical, i.e. the phone
 * is lying close to a tabletop. Users tilting up/down ≥ 30° for AR must NOT
 * trigger this — they are still holding the phone vertical-ish.
 */
export function isScreenHorizontalFromGravity(
  x: number,
  y: number,
  z: number,
  screenAngleDeg: number
): boolean {
  const g = gravityInScreenFrame(x, y, z, screenAngleDeg);
  const mag = Math.hypot(g.x, g.y, g.z);
  if (mag < 5) return false;
  // cos(25°) ≈ 0.91: screen normal within 25° of vertical → on a table.
  return Math.abs(g.z) / mag > 0.91;
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

/**
 * Pitch from gravity (m/s²) in screen space: elevation above the screen plane.
 * 0° = level at horizon, positive = toward sky. Works in portrait and landscape.
 */
export function pitchFromGravity(
  x: number,
  y: number,
  z: number,
  screenAngleDeg: number
): number {
  const g = gravityInScreenFrame(x, y, z, screenAngleDeg);
  const horizontal = Math.hypot(g.x, g.y);
  return (Math.atan2(g.z, horizontal) * 180) / Math.PI;
}

export function mergePitchReadings(orientationPitch: number | null, gravityPitch: number | null): number | null {
  if (orientationPitch != null && gravityPitch != null) {
    return orientationPitch * 0.75 + gravityPitch * 0.25;
  }
  return gravityPitch ?? orientationPitch;
}
