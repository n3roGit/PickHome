"use client";

import dynamic from "next/dynamic";
import { useCallback, useMemo, useState, useTransition } from "react";
import { deleteApartmentPhotoAction } from "@/app/apartment-photo-actions";
import { FileDropzone } from "@/components/FileDropzone";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { usePhotoUploadQueue } from "@/hooks/use-photo-upload-queue";
import { pickValidImageFiles } from "@/lib/apartment-photo-files";
import type { GalleryPhoto } from "@/lib/gallery-photo";
import { MAX_IMAGE_BYTES, MAX_IMAGE_MB } from "@/lib/upload-limits";
import { apartmentPhotoUploadErrorMessage } from "@/lib/upload-messages";

const PhotoGallery = dynamic(
  () => import("@/components/PhotoGallery").then((mod) => mod.PhotoGallery),
  {
    loading: () => (
      <p className="text-sm text-pn-text-tertiary mb-4">Galerie wird geladen…</p>
    ),
  }
);

export default function ApartmentPhotos({
  apartmentId,
  photos,
}: {
  apartmentId: string;
  photos: GalleryPhoto[];
}) {
  const [deletePending, startDeleteTransition] = useTransition();
  const [uploadError, setUploadError] = useState<string | null>(null);
  const queue = usePhotoUploadQueue(apartmentId);

  const displayPhotos = useMemo(
    () => [...photos, ...queue.pendingGalleryPhotos],
    [photos, queue.pendingGalleryPhotos]
  );

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

  function onUploadFormData(formData: FormData) {
    const files = formData
      .getAll("photo")
      .filter((entry): entry is File => entry instanceof File);
    ingestFiles(files);
  }

  function onDeletePending(pendingId: string) {
    queue.removeItem(pendingId);
  }

  const captureDisabled = queue.queueFull;

  return (
    <CollapsibleSection
      title="Bilder"
      defaultOpen
      headerAside={
        displayPhotos.length > 0 ? `${photos.length} Bilder` : undefined
      }
    >
      {displayPhotos.length > 0 ? (
        <PhotoGallery
          photos={displayPhotos}
          deletePending={deletePending}
          onDelete={(photoId) => {
            const pending = queue.pendingGalleryPhotos.find((p) => p.id === photoId);
            if (pending?.pending) {
              onDeletePending(photoId);
              return;
            }
            startDeleteTransition(() => deleteApartmentPhotoAction(photoId));
          }}
        />
      ) : (
        <p className="text-sm text-pn-text-tertiary mb-4">Noch keine Bilder hinterlegt.</p>
      )}
      {uploadError && (
        <p className="mb-3 text-sm text-pn-score-low bg-pn-score-low-bg px-3 py-2 rounded-lg">
          {uploadError}
        </p>
      )}
      {queue.progressLabel && (
        <p className="mb-3 text-sm text-pn-text-secondary">{queue.progressLabel}</p>
      )}
      {queue.errorItems.map((item) => (
        <div
          key={item.id}
          className="mb-2 flex flex-wrap items-center gap-2 text-sm text-pn-score-low bg-pn-score-low-bg px-3 py-2 rounded-lg"
        >
          <span>{item.errorMessage ?? "Upload fehlgeschlagen"}</span>
          <button
            type="button"
            className="text-pn-accent hover:underline font-medium"
            onClick={() => queue.retry(item.id)}
          >
            Erneut versuchen
          </button>
          <button
            type="button"
            className="text-pn-text-secondary hover:underline"
            onClick={() => queue.removeItem(item.id)}
          >
            Verwerfen
          </button>
        </div>
      ))}
      <FileDropzone
        name="photo"
        accept="image/jpeg,image/png,image/webp,image/*"
        hint={`Oder Galerie / Dateien (JPG, PNG, WebP, mehrere möglich, max. ${MAX_IMAGE_MB} MB je Datei)`}
        multiple
        disabled={captureDisabled}
        maxBytes={MAX_IMAGE_BYTES}
        onTooLarge={(fileName) =>
          setUploadError(apartmentPhotoUploadErrorMessage("too_large", fileName))
        }
        onFiles={onUploadFormData}
      />
    </CollapsibleSection>
  );
}
