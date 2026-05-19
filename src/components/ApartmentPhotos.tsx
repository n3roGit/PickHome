"use client";

import Image from "next/image";
import { useTransition } from "react";
import { deleteApartmentPhotoAction, uploadApartmentPhotoAction } from "@/app/actions";
import { FileDropzone } from "@/components/FileDropzone";

type Photo = { id: string; url: string; caption: string | null };

export function ApartmentPhotos({
  apartmentId,
  photos,
}: {
  apartmentId: string;
  photos: Photo[];
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
      <h2 className="text-lg font-semibold mb-3">Bilder</h2>
      {photos.length > 0 ? (
        <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          {photos.map((p) => (
            <li
              key={p.id}
              className="relative group border border-pn-border rounded-lg overflow-hidden bg-pn-bg-subtle"
            >
              <Image
                src={p.url}
                alt={p.caption ?? "Immobilienfoto"}
                width={400}
                height={300}
                className="w-full h-36 object-cover"
              />
              <button
                type="button"
                disabled={pending}
                onClick={() => startTransition(() => deleteApartmentPhotoAction(p.id))}
                className="absolute top-2 right-2 text-xs bg-black/60 text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
              >
                Entfernen
              </button>
            </li>
          ))}
        </ul>
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
