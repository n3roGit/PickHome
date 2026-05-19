"use client";

import { useTransition } from "react";
import { deleteApartmentPhotoAction, uploadApartmentPhotoAction } from "@/app/actions";
import { FileDropzone } from "@/components/FileDropzone";
import { PhotoGallery, type GalleryPhoto } from "@/components/PhotoGallery";

export function ApartmentPhotos({
  apartmentId,
  photos,
}: {
  apartmentId: string;
  photos: GalleryPhoto[];
}) {
  const [pending, startTransition] = useTransition();

  function onUpload(formData: FormData) {
    startTransition(async () => {
      const files = formData.getAll("photo");
      for (const file of files) {
        if (!(file instanceof File) || file.size === 0) continue;
        const single = new FormData();
        single.set("photo", file);
        await uploadApartmentPhotoAction(apartmentId, single);
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
      <FileDropzone
        name="photo"
        accept="image/jpeg,image/png,image/webp"
        hint="JPG, PNG oder WebP, max. 5 MB — mehrere Dateien möglich"
        multiple
        disabled={pending}
        onFiles={onUpload}
      />
    </section>
  );
}
