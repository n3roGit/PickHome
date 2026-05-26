/**
 * AR view angles from DeviceOrientation (W3C Device Orientation spec).
 * Device held vertically in portrait; back camera looks along -Z in device frame.
 * @see https://www.w3.org/TR/orientation-event/
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Device_orientation_events/Detecting_device_orientation
 */

const DEG2RAD = Math.PI / 180;

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
 * Compass heading (degrees, 0 = north, clockwise) when the device is held vertically
 * for AR — W3C worked example A.1.
 */
export function compassHeadingFromOrientation(
  alpha: number,
  beta: number,
  gamma: number
): number {
  const _x = beta * DEG2RAD;
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
 * Uses back-camera look direction (-Z in device frame) in the Earth frame.
 */
export function viewPitchFromOrientation(
  alpha: number,
  beta: number,
  gamma: number,
  screenAngleDeg: number
): number {
  const r = getRotationMatrix(alpha, beta, gamma);
  const rs = mat3RotateZ(-normalizeScreenAngle(screenAngleDeg));
  const m = multiplyMat3(rs, r);

  // Device -Z (rear camera forward) in world coordinates = negative third column
  const dx = -m[2];
  const dy = -m[5];
  const dz = -m[8];

  const horizontal = Math.hypot(dx, dy);
  return (Math.atan2(-dz, horizontal) * 180) / Math.PI;
}

export type ArViewOrientation = {
  heading: number;
  pitch: number;
};

export function viewOrientationFromEvent(
  alpha: number | null,
  beta: number | null,
  gamma: number | null,
  screenAngleDeg: number
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

  return {
    heading: compassHeadingFromOrientation(alpha, beta, gamma),
    pitch: viewPitchFromOrientation(alpha, beta, gamma, screenAngleDeg),
  };
}
