import { mkdir, unlink, writeFile } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { getApartmentUploadsRoot, publicPhotoPath } from "@/lib/pickhome-data";
import { MAX_DOCUMENT_BYTES, MAX_IMAGE_BYTES } from "@/lib/upload-limits";

export { publicPhotoPath };
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
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
  if (type === "image/heic" || type === "image/heif") return ".heic";
  if (type === "application/pdf") return ".pdf";
  if (type === "image/jpeg") return ".jpg";
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) return ".pdf";
  if (lower.endsWith(".png")) return ".png";
  if (lower.endsWith(".webp")) return ".webp";
  return ".jpg";
}

function isAllowedImageFile(file: File): boolean {
  if (IMAGE_TYPES.has(file.type) || file.type.startsWith("image/")) return true;
  return /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name);
}

async function saveFile(
  apartmentId: string,
  file: File,
  subdir: "" | "documents"
): Promise<{ url: string; mimeType: string; fileName: string }> {
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  const allowedImage = isAllowedImageFile(file);
  if (subdir === "documents") {
    if (!DOCUMENT_TYPES.has(file.type) && !isPdf && !allowedImage) {
      throw new Error("invalid_type");
    }
  } else if (!allowedImage) {
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

export async function saveApartmentDocument(
  apartmentId: string,
  file: File,
  buffer?: Buffer
) {
  const isPdf =
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) throw new Error("invalid_type");
  const data = buffer ?? Buffer.from(await file.arrayBuffer());
  return saveFileWithBuffer(apartmentId, file, data, "documents");
}

async function saveFileWithBuffer(
  apartmentId: string,
  file: File,
  buffer: Buffer,
  subdir: "" | "documents"
): Promise<{ url: string; mimeType: string; fileName: string }> {
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  const allowed = subdir === "documents" ? DOCUMENT_TYPES : IMAGE_TYPES;
  if (!allowed.has(file.type) && !(subdir === "documents" && isPdf)) {
    throw new Error("invalid_type");
  }
  const max = subdir === "documents" && isPdf ? MAX_DOCUMENT_BYTES : MAX_IMAGE_BYTES;
  if (buffer.length > max) throw new Error("too_large");

  const ext = extForMime(file.type, file.name);
  const filename = `${randomUUID()}${ext}`;
  const dir = join(apartmentDir(apartmentId), subdir);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, filename), buffer);
  const path = subdir ? `documents/${filename}` : filename;
  return {
    url: `/uploads/apartments/${apartmentId}/${path}`,
    mimeType: isPdf ? "application/pdf" : file.type || "application/octet-stream",
    fileName: file.name || filename,
  };
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
