import { join } from "path";

/** Persistent app data (DB, uploads). Default: ./data — gitignored, Docker bind-mount. */
export function getPickHomeDataDir() {
  const dir = process.env.PICKHOME_DATA_DIR;
  if (dir) return dir.startsWith("/") || /^[A-Za-z]:/.test(dir) ? dir : join(process.cwd(), dir);
  return join(process.cwd(), "data");
}

export function getUploadsRoot() {
  return join(getPickHomeDataDir(), "uploads");
}

export function getApartmentUploadsRoot() {
  return join(getUploadsRoot(), "apartments");
}

export function publicPhotoPath(url: string) {
  if (!url.startsWith("/uploads/")) return null;
  const rel = url.replace(/^\/uploads\//, "");
  return join(getUploadsRoot(), rel);
}
