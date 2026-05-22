import { apartmentPhotoUploadErrorMessage } from "@/lib/upload-messages";
import { MAX_IMAGE_BYTES } from "@/lib/upload-limits";

export function pickValidImageFiles(
  files: File[],
  onRejected: (message: string) => void
): File[] {
  const valid: File[] = [];
  for (const file of files) {
    if (file.size === 0) continue;
    if (file.size > MAX_IMAGE_BYTES) {
      onRejected(apartmentPhotoUploadErrorMessage("too_large", file.name));
      continue;
    }
    valid.push(file);
  }
  return valid;
}
