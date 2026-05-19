"use client";

import { useState, useTransition } from "react";
import { deleteApartmentPhotoAction, uploadApartmentPhotoAction } from "@/app/actions";
import { FileDropzone } from "@/components/FileDropzone";
import { PhotoGallery, type GalleryPhoto } from "@/components/PhotoGallery";
import { MAX_IMAGE_BYTES, MAX_IMAGE_MB } from "@/lib/upload-limits";
import { apartmentPhotoUploadErrorMessage } from "@/lib/upload-messages";

export function ApartmentPhotos({
  apartmentId,
  photos,
}: {
  apartmentId: string;
  photos: GalleryPhoto[];
}) {
  const [pending, startTransition] = useTransition();
  const [uploadError, setUploadError] = useState<string | null>(null);

  function onUpload(formData: FormData) {
    startTransition(async () => {
      setUploadError(null);
      const files = formData.getAll("photo");
      let uploaded = 0;
      for (const file of files) {
        if (!(file instanceof File) || file.size === 0) continue;
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
  }

  return (
    <section className="mb-10">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <h2 className="text-lg font-semibold">Bilder</h2>
        {photos.length > 0 && (
          <p className="text-sm text-pn-text-tertiary tabular-nums">{photos.length} Bilder</p>
        )}
      </div>
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
      <FileDropzone
        name="photo"
        accept="image/jpeg,image/png,image/webp"
        hint={`JPG, PNG oder WebP, max. ${MAX_IMAGE_MB} MB — mehrere Dateien möglich`}
        multiple
        disabled={pending}
        maxBytes={MAX_IMAGE_BYTES}
        onTooLarge={(fileName) =>
          setUploadError(apartmentPhotoUploadErrorMessage("too_large", fileName))
        }
        onFiles={onUpload}
      />
    </section>
  );
}
