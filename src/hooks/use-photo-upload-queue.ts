"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  flushApartmentPhotoRevalidateAction,
  uploadApartmentPhotoAction,
} from "@/app/apartment-photo-actions";
import type { GalleryPhoto } from "@/lib/gallery-photo";
import {
  countActiveUploads,
  PHOTO_UPLOAD_CONCURRENCY,
  PHOTO_UPLOAD_MAX_QUEUE,
  type PhotoUploadQueueItem,
  uploadProgressLabel,
} from "@/lib/photo-upload-queue";
import { apartmentPhotoUploadErrorMessage } from "@/lib/upload-messages";

function createQueueItem(file: File): PhotoUploadQueueItem {
  return {
    id: crypto.randomUUID(),
    file,
    fileName: file.name,
    previewUrl: URL.createObjectURL(file),
    status: "queued",
  };
}

export function usePhotoUploadQueue(apartmentId: string) {
  const router = useRouter();
  const [items, setItems] = useState<PhotoUploadQueueItem[]>([]);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const processingRef = useRef(false);
  const flushScheduledRef = useRef(false);

  const revokePreview = useCallback((previewUrl: string) => {
    URL.revokeObjectURL(previewUrl);
  }, []);

  const scheduleFlush = useCallback(() => {
    if (flushScheduledRef.current) return;
    flushScheduledRef.current = true;
    void flushApartmentPhotoRevalidateAction(apartmentId).then(() => {
      flushScheduledRef.current = false;
      router.refresh();
    });
  }, [apartmentId, router]);

  const processOne = useCallback(
    async (item: PhotoUploadQueueItem) => {
      const form = new FormData();
      form.set("photo", item.file);
      const result = await uploadApartmentPhotoAction(apartmentId, form, { revalidate: false });
      setItems((prev) => {
        const next = prev.map((i) => {
          if (i.id !== item.id) return i;
          revokePreview(i.previewUrl);
          if (result && !result.ok) {
            return {
              ...i,
              status: "error" as const,
              errorMessage: apartmentPhotoUploadErrorMessage(result.error, i.fileName),
            };
          }
          return { ...i, status: "done" as const };
        });
        itemsRef.current = next;
        return next;
      });
    },
    [apartmentId, revokePreview]
  );

  const pump = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;
    try {
      while (true) {
        const snapshot = itemsRef.current;
        const uploading = snapshot.filter((i) => i.status === "uploading").length;
        if (uploading >= PHOTO_UPLOAD_CONCURRENCY) break;
        const next = snapshot.find((i) => i.status === "queued");
        if (!next) break;

        setItems((prev) => {
          const updated = prev.map((i) =>
            i.id === next.id ? { ...i, status: "uploading" as const } : i
          );
          itemsRef.current = updated;
          return updated;
        });

        await processOne(next);
      }

      const after = itemsRef.current;
      const active = countActiveUploads(after);
      if (active === 0 && after.some((i) => i.status === "done")) {
        scheduleFlush();
        setItems((prev) => {
          const remaining = prev.filter((i) => i.status !== "done");
          itemsRef.current = remaining;
          return remaining;
        });
      }
    } finally {
      processingRef.current = false;
    }
  }, [processOne, scheduleFlush]);

  useEffect(() => {
    if (countActiveUploads(items) === 0) return;
    void pump();
  }, [items, pump]);

  useEffect(() => {
    return () => {
      for (const item of itemsRef.current) {
        URL.revokeObjectURL(item.previewUrl);
      }
    };
  }, []);

  const enqueue = useCallback((files: File[]) => {
    const room = PHOTO_UPLOAD_MAX_QUEUE - itemsRef.current.length;
    if (room <= 0) return { rejected: files.length, added: 0 };

    const toAdd = files.slice(0, room);
    const newItems = toAdd.map(createQueueItem);
    setItems((prev) => {
      const next = [...prev, ...newItems];
      itemsRef.current = next;
      return next;
    });
    return { rejected: files.length - toAdd.length, added: toAdd.length };
  }, []);

  const retry = useCallback((id: string) => {
    setItems((prev) => {
      const next = prev.map((i) =>
        i.id === id ? { ...i, status: "queued" as const, errorMessage: undefined } : i
      );
      itemsRef.current = next;
      return next;
    });
  }, []);

  const removeItem = useCallback(
    (id: string) => {
      setItems((prev) => {
        const item = prev.find((i) => i.id === id);
        if (item) revokePreview(item.previewUrl);
        const next = prev.filter((i) => i.id !== id);
        itemsRef.current = next;
        return next;
      });
    },
    [revokePreview]
  );

  const pendingGalleryPhotos: GalleryPhoto[] = items
    .filter((i) => i.status !== "done")
    .map((i) => ({
      id: i.id,
      url: i.previewUrl,
      caption: i.fileName,
      pending: true,
      uploading: i.status === "uploading" || i.status === "queued",
      uploadError: i.status === "error",
    }));

  return {
    enqueue,
    retry,
    removeItem,
    pendingGalleryPhotos,
    progressLabel: uploadProgressLabel(items),
    queueFull: items.length >= PHOTO_UPLOAD_MAX_QUEUE,
    isUploading: countActiveUploads(items) > 0,
    errorItems: items.filter((i) => i.status === "error"),
  };
}
