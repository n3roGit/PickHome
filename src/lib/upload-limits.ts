/** Client-safe upload limits (no Node.js fs imports). */

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_DOCUMENT_BYTES = 30 * 1024 * 1024;
export const MAX_IMAGE_MB = 10;
export const MAX_DOCUMENT_MB = 30;

export type ApartmentUploadError = "too_large" | "invalid_type";

export function isApartmentUploadError(message: string): message is ApartmentUploadError {
  return message === "too_large" || message === "invalid_type";
}
