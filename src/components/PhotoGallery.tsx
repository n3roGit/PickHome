"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";

import type { GalleryPhoto } from "@/lib/gallery-photo";

const ZOOM_STEPS = [1, 1.25, 1.5, 2, 2.5, 3];

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
  const [zoomIndex, setZoomIndex] = useState(0);

  const open = index !== null;
  const current = index !== null ? photos[index] : null;
  const zoom = ZOOM_STEPS[zoomIndex];

  const close = useCallback(() => {
    setIndex(null);
    setZoomIndex(0);
  }, []);

  const goPrev = useCallback(() => {
    setIndex((i) => (i === null ? null : (i - 1 + photos.length) % photos.length));
    setZoomIndex(0);
  }, [photos.length]);

  const goNext = useCallback(() => {
    setIndex((i) => (i === null ? null : (i + 1) % photos.length));
    setZoomIndex(0);
  }, [photos.length]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "+" || e.key === "=") setZoomIndex((z) => Math.min(z + 1, ZOOM_STEPS.length - 1));
      if (e.key === "-") setZoomIndex((z) => Math.max(z - 1, 0));
    }
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, close, goPrev, goNext]);

  if (photos.length === 0) return null;

  return (
    <>
      <div className="mb-4">
        <button
          type="button"
          onClick={() => {
            setIndex(0);
            setZoomIndex(0);
          }}
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
              onClick={() => {
                setIndex(i);
                setZoomIndex(0);
              }}
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

      {open && current && index !== null && (
        <div
          className="fixed inset-0 z-[100] flex flex-col bg-black/95"
          role="dialog"
          aria-modal="true"
          aria-label="Bildergalerie"
        >
          <div className="flex items-center justify-between gap-2 px-4 py-3 text-white shrink-0">
            <p className="text-sm font-medium tabular-nums">
              Bild {index + 1} von {photos.length}
              {current.caption ? ` · ${current.caption}` : ""}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setZoomIndex((z) => Math.max(z - 1, 0))}
                disabled={zoomIndex === 0}
                className="px-2.5 py-1.5 text-sm rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-40"
                aria-label="Verkleinern"
              >
                −
              </button>
              <span className="text-xs tabular-nums w-12 text-center">{Math.round(zoom * 100)}%</span>
              <button
                type="button"
                onClick={() => setZoomIndex((z) => Math.min(z + 1, ZOOM_STEPS.length - 1))}
                disabled={zoomIndex === ZOOM_STEPS.length - 1}
                className="px-2.5 py-1.5 text-sm rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-40"
                aria-label="Vergrößern"
              >
                +
              </button>
              <button
                type="button"
                onClick={close}
                className="px-3 py-1.5 text-sm font-medium rounded-lg bg-white/10 hover:bg-white/20"
              >
                Schließen
              </button>
            </div>
          </div>

          <div className="relative flex-1 min-h-0 flex items-center justify-center px-14">
            <button
              type="button"
              onClick={goPrev}
              className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/25 text-white text-xl"
              aria-label="Vorheriges Bild"
            >
              ‹
            </button>

            <div className="w-full h-full flex items-center justify-center overflow-auto p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={current.url}
                alt={current.caption ?? `Immobilienfoto ${index + 1}`}
                className="max-w-full max-h-full object-contain transition-transform duration-150"
                style={{ transform: `scale(${zoom})` }}
                draggable={false}
              />
            </div>

            <button
              type="button"
              onClick={goNext}
              className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/25 text-white text-xl"
              aria-label="Nächstes Bild"
            >
              ›
            </button>
          </div>

          <div className="shrink-0 px-4 pb-4 pt-2 flex gap-2 overflow-x-auto">
            {photos.map((p, i) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setIndex(i);
                  setZoomIndex(0);
                }}
                className={`relative shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 ${
                  i === index ? "border-pn-accent" : "border-transparent opacity-70 hover:opacity-100"
                }`}
              >
                <Image src={p.thumbUrl ?? p.url} alt="" fill className="object-cover" sizes="64px" />
              </button>
            ))}
          </div>

          {onDelete && (
            <div className="shrink-0 px-4 pb-4 flex justify-center">
              <button
                type="button"
                disabled={deletePending}
                onClick={() => {
                  if (!window.confirm("Dieses Bild wirklich entfernen?")) return;
                  onDelete(current.id);
                  if (photos.length <= 1) close();
                  else if (index >= photos.length - 1) setIndex(photos.length - 2);
                }}
                className="text-sm text-red-300 hover:text-red-200 disabled:opacity-50"
              >
                Dieses Bild entfernen
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
