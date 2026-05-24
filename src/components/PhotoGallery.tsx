"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Lightbox, { useLightboxState } from "yet-another-react-lightbox";
import Captions from "yet-another-react-lightbox/plugins/captions";
import Counter from "yet-another-react-lightbox/plugins/counter";
import Thumbnails from "yet-another-react-lightbox/plugins/thumbnails";
import Zoom from "yet-another-react-lightbox/plugins/zoom";

import type { GalleryPhoto } from "@/lib/gallery-photo";

import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/captions.css";
import "yet-another-react-lightbox/plugins/thumbnails.css";
import "./photo-gallery-lightbox.css";

function DeletePhotoButton({
  photos,
  onDelete,
  deletePending,
  onAfterDelete,
}: {
  photos: GalleryPhoto[];
  onDelete: (photoId: string) => void;
  deletePending?: boolean;
  onAfterDelete: (remainingCount: number, deletedIndex: number) => void;
}) {
  const { currentIndex } = useLightboxState();
  const photo = photos[currentIndex];
  if (!photo) return null;

  return (
    <button
      key="delete"
      type="button"
      className="yarl__button photo-gallery-lightbox__delete"
      aria-label="Dieses Bild entfernen"
      title="Dieses Bild entfernen"
      disabled={deletePending}
      onClick={() => {
        if (!window.confirm("Dieses Bild wirklich entfernen?")) return;
        onDelete(photo.id);
        onAfterDelete(photos.length - 1, currentIndex);
      }}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
      </svg>
    </button>
  );
}

export function PhotoGallery({
  photos,
  onDelete,
  deletePending,
}: {
  photos: GalleryPhoto[];
  onDelete?: (photoId: string) => void;
  deletePending?: boolean;
}) {
  const [index, setIndex] = useState<number | null>(null);
  const [chromeVisible, setChromeVisible] = useState(true);

  const open = index !== null;

  const slides = useMemo(
    () =>
      photos.map((p, i) => ({
        src: p.url,
        alt: p.caption ?? `Immobilienfoto ${i + 1}`,
        title: p.caption ?? undefined,
        thumbnail: p.thumbUrl ?? p.url,
      })),
    [photos]
  );

  const openAt = useCallback((i: number) => {
    setIndex(i);
    setChromeVisible(true);
  }, []);

  const close = useCallback(() => {
    setIndex(null);
    setChromeVisible(true);
  }, []);

  const handleAfterDelete = useCallback((remainingCount: number, deletedIndex: number) => {
    if (remainingCount <= 0) {
      setIndex(null);
      return;
    }
    if (deletedIndex >= remainingCount) {
      setIndex(remainingCount - 1);
    }
  }, []);

  useEffect(() => {
    if (index === null) return;
    if (photos.length === 0) {
      setIndex(null);
    } else if (index >= photos.length) {
      setIndex(photos.length - 1);
    }
  }, [photos.length, index]);

  if (photos.length === 0) return null;

  const toolbarButtons: (ReactNode | "close")[] = onDelete
    ? [
        <DeletePhotoButton
          key="delete"
          photos={photos}
          onDelete={onDelete}
          deletePending={deletePending}
          onAfterDelete={handleAfterDelete}
        />,
        "close",
      ]
    : ["close"];

  return (
    <>
      <div className="mb-4">
        <button
          type="button"
          onClick={() => openAt(0)}
          className="relative w-full aspect-[16/10] max-h-[420px] rounded-xl overflow-hidden border border-pn-border bg-pn-bg-subtle group block"
        >
          <Image
            src={photos[0].thumbUrl ?? photos[0].url}
            alt={photos[0].caption ?? "Immobilienfoto 1"}
            fill
            className="object-cover transition-transform group-hover:scale-[1.02]"
            sizes="(max-width: 896px) 100vw, 896px"
            priority
          />
          <span className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none" />
          <span className="absolute bottom-3 right-3 text-xs font-medium bg-black/60 text-white px-2.5 py-1 rounded-lg pointer-events-none">
            Galerie öffnen · {photos.length} Bilder
          </span>
        </button>
      </div>

      <ul className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 mb-2">
        {photos.map((p, i) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => openAt(i)}
              className={`relative w-full aspect-square rounded-lg overflow-hidden border bg-pn-bg-subtle ${
                i === 0 ? "ring-2 ring-pn-accent border-pn-accent" : "border-pn-border"
              }`}
            >
              <Image
                src={p.thumbUrl ?? p.url}
                alt={p.caption ?? `Immobilienfoto ${i + 1}`}
                fill
                className="object-cover"
                sizes="120px"
                unoptimized={p.pending}
              />
              {p.pending && (
                <span
                  className={`absolute inset-0 flex items-center justify-center text-xs font-medium ${
                    p.uploadError
                      ? "bg-pn-score-low/80 text-white"
                      : "bg-black/40 text-white"
                  }`}
                >
                  {p.uploadError ? "Fehler" : p.uploading ? "…" : ""}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>

      <Lightbox
        open={open}
        close={close}
        index={index ?? 0}
        slides={slides}
        plugins={[Zoom, Thumbnails, Counter, Captions]}
        className={`photo-gallery-lightbox${chromeVisible ? "" : " photo-gallery-lightbox--chrome-hidden"}`}
        carousel={{ finite: false, preload: 1 }}
        zoom={{ maxZoomPixelRatio: 3, doubleTapDelay: 300, doubleClickDelay: 300 }}
        controller={{ closeOnPullDown: false, closeOnBackdropClick: false }}
        thumbnails={{ position: "bottom", width: 64, height: 64, border: 2, borderColor: "transparent" }}
        labels={{
          Previous: "Vorheriges Bild",
          Next: "Nächstes Bild",
          Close: "Schließen",
          "Zoom in": "Vergrößern",
          "Zoom out": "Verkleinern",
          Lightbox: "Bildergalerie",
          "{index} of {total}": "{index} von {total}",
        }}
        toolbar={{ buttons: toolbarButtons }}
        on={{
          view: ({ index: i }) => {
            setIndex(i);
            setChromeVisible(true);
          },
          click: () => setChromeVisible((visible) => !visible),
        }}
      />
    </>
  );
}
