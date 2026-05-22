"use client";

import { useCallback, useState } from "react";
import { PhotoCaptureInput } from "@/components/PhotoCaptureInput";
import { usePhotoUploadQueue } from "@/hooks/use-photo-upload-queue";
import { pickValidImageFiles } from "@/lib/apartment-photo-files";
import { apartmentPhotoUploadErrorMessage } from "@/lib/upload-messages";
import { MAX_IMAGE_BYTES } from "@/lib/upload-limits";

export function ApartmentPhotoCameraButton({ apartmentId }: { apartmentId: string }) {
  const [uploadError, setUploadError] = useState<string | null>(null);
  const queue = usePhotoUploadQueue(apartmentId);

  const ingestFiles = useCallback(
    (files: File[]) => {
      setUploadError(null);
      const valid = pickValidImageFiles(files, setUploadError);
      if (valid.length === 0) return;
      const { rejected, added } = queue.enqueue(valid);
      if (rejected > 0) {
        setUploadError(
          `Maximal ${added > 0 ? "weitere " : ""}${rejected} Foto(s) nicht in die Warteschlange aufgenommen (Limit erreicht).`
        );
      }
    },
    [queue]
  );

  const busyLabel = queue.progressLabel;
  const title = [busyLabel, uploadError, queue.queueFull ? "Warteschlange voll" : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <span className="inline-flex items-center" title={title || undefined}>
      <PhotoCaptureInput
        variant="toolbar"
        disabled={queue.queueFull}
        maxBytes={MAX_IMAGE_BYTES}
        onTooLarge={(fileName) =>
          setUploadError(apartmentPhotoUploadErrorMessage("too_large", fileName))
        }
        onFiles={ingestFiles}
      />
    </span>
  );
}
