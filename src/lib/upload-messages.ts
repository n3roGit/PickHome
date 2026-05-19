import type { ApartmentUploadError } from "@/lib/apartment-media";
import { MAX_DOCUMENT_MB, MAX_IMAGE_MB } from "@/lib/apartment-media";

export function apartmentPhotoUploadErrorMessage(
  error: ApartmentUploadError,
  fileName?: string
): string {
  const label = fileName ? `„${fileName}"` : "Die Datei";
  if (error === "too_large") {
    return `${label} ist zu groß (max. ${MAX_IMAGE_MB} MB pro Bild).`;
  }
  return `${label} hat ein ungültiges Format (nur JPG, PNG oder WebP).`;
}

export function apartmentDocumentUploadErrorMessage(
  error: ApartmentUploadError,
  fileName?: string
): string {
  const label = fileName ? `„${fileName}"` : "Die Datei";
  if (error === "too_large") {
    return `${label} ist zu groß (max. ${MAX_DOCUMENT_MB} MB).`;
  }
  return `${label} ist keine gültige PDF-Datei.`;
}
