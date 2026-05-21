"use client";

import dynamic from "next/dynamic";
import { useCallback, useState, useTransition } from "react";
import {
  deleteApartmentPhotoAction,
  uploadApartmentPhotoAction,
} from "@/app/apartment-photo-actions";
import { FileDropzone } from "@/components/FileDropzone";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { PhotoCaptureInput } from "@/components/PhotoCaptureInput";
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
  const [pending, startTransition] = useTransition();
  const [uploadError, setUploadError] = useState<string | null>(null);

  const uploadFiles = useCallback(
    (files: File[]) => {
      startTransition(async () => {
        setUploadError(null);
        let uploaded = 0;
        for (const file of files) {
          if (file.size === 0) continue;
          if (file.size > MAX_IMAGE_BYTES) {
            setUploadError(apartmentPhotoUploadErrorMessage("too_large", file.name));
            continue;
          }
          const single = new FormData();
          single.set("photo", file);
          const result = await uploadApartmentPhotoAction(apartmentId, single);
          if (result && !result.ok) {
            setUploadError(apartmentPhotoUploadErrorMessage(result.error, file.name));
            continue;
          }
          uploaded += 1;
        }
      });
    },
    [apartmentId]
  );

  function onUploadFormData(formData: FormData) {
    const files = formData
      .getAll("photo")
      .filter((entry): entry is File => entry instanceof File);
    uploadFiles(files);
  }

  return (
    <CollapsibleSection
      title="Bilder"
      defaultOpen
      headerAside={photos.length > 0 ? `${photos.length} Bilder` : undefined}
    >
      {photos.length > 0 ? (
        <PhotoGallery
          photos={photos}
          deletePending={pending}
          onDelete={(photoId) => startTransition(() => deleteApartmentPhotoAction(photoId))}
        />
      ) : (
        <p className="text-sm text-pn-text-tertiary mb-4">Noch keine Bilder hinterlegt.</p>
      )}
      {uploadError && (
        <p className="mb-3 text-sm text-pn-score-low bg-pn-score-low-bg px-3 py-2 rounded-lg">
          {uploadError}
        </p>
      )}
      {pending && (
        <p className="mb-3 text-sm text-pn-text-secondary">Bilder werden hochgeladen…</p>
      )}
      <div className="mb-3">
        <PhotoCaptureInput
          disabled={pending}
          maxBytes={MAX_IMAGE_BYTES}
          onTooLarge={(fileName) =>
            setUploadError(apartmentPhotoUploadErrorMessage("too_large", fileName))
          }
          onFiles={uploadFiles}
        />
        <p className="text-xs text-pn-text-tertiary mt-2">
          Auf dem Smartphone öffnet „Kamera“ die Gerätekamera — mehrere Fotos nacheinander oder
          gesammelt bestätigen, sie werden automatisch hochgeladen.
        </p>
      </div>
      <FileDropzone
        name="photo"
        accept="image/jpeg,image/png,image/webp,image/*"
        hint={`Oder Galerie / Dateien (JPG, PNG, WebP, mehrere möglich, max. ${MAX_IMAGE_MB} MB je Datei)`}
        multiple
        disabled={pending}
        maxBytes={MAX_IMAGE_BYTES}
        onTooLarge={(fileName) =>
          setUploadError(apartmentPhotoUploadErrorMessage("too_large", fileName))
        }
        onFiles={onUploadFormData}
      />
    </CollapsibleSection>
  );
}
