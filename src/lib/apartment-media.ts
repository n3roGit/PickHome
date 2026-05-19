import { mkdir, unlink, writeFile } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { getApartmentUploadsRoot, publicPhotoPath } from "@/lib/pickhome-data";

export { publicPhotoPath };

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_DOCUMENT_BYTES = 30 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const DOCUMENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

function apartmentDir(apartmentId: string) {
  return join(getApartmentUploadsRoot(), apartmentId);
}

function extForMime(type: string, fileName: string) {
  if (type === "image/png") return ".png";
  if (type === "image/webp") return ".webp";
  if (type === "application/pdf") return ".pdf";
  if (type === "image/jpeg") return ".jpg";
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) return ".pdf";
  if (lower.endsWith(".png")) return ".png";
  if (lower.endsWith(".webp")) return ".webp";
  return ".jpg";
}

async function saveFile(
  apartmentId: string,
  file: File,
  subdir: "" | "documents"
): Promise<{ url: string; mimeType: string; fileName: string }> {
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  const allowed = subdir === "documents" ? DOCUMENT_TYPES : IMAGE_TYPES;
  if (!allowed.has(file.type) && !(subdir === "documents" && isPdf)) {
    throw new Error("invalid_type");
  }
  const max = subdir === "documents" && isPdf ? MAX_DOCUMENT_BYTES : MAX_IMAGE_BYTES;
  if (file.size > max) throw new Error("too_large");

  const ext = extForMime(file.type, file.name);
  const filename = `${randomUUID()}${ext}`;
  const dir = join(apartmentDir(apartmentId), subdir);
  await mkdir(dir, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(join(dir, filename), buffer);
  const path = subdir ? `documents/${filename}` : filename;
  return {
    url: `/uploads/apartments/${apartmentId}/${path}`,
    mimeType: isPdf ? "application/pdf" : file.type || "application/octet-stream",
    fileName: file.name || filename,
  };
}

export async function saveApartmentPhoto(apartmentId: string, file: File) {
  const saved = await saveFile(apartmentId, file, "");
  return saved.url;
}

export async function saveApartmentDocument(apartmentId: string, file: File) {
  const isPdf =
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) throw new Error("invalid_type");
  return saveFile(apartmentId, file, "documents");
}

export async function deleteApartmentPhotoFile(url: string) {
  const path = publicPhotoPath(url);
  if (!path) return;
  try {
    await unlink(path);
  } catch {
    // file may already be gone
  }
}
