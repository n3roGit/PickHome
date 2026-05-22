export const PHOTO_UPLOAD_CONCURRENCY = 3;
export const PHOTO_UPLOAD_MAX_QUEUE = 20;

export type PhotoUploadQueueStatus = "queued" | "uploading" | "done" | "error";

export type PhotoUploadQueueItem = {
  id: string;
  file: File;
  fileName: string;
  previewUrl: string;
  status: PhotoUploadQueueStatus;
  errorMessage?: string;
};

export function countActiveUploads(items: PhotoUploadQueueItem[]): number {
  return items.filter((i) => i.status === "queued" || i.status === "uploading").length;
}

export function countDoneUploads(items: PhotoUploadQueueItem[]): number {
  return items.filter((i) => i.status === "done").length;
}

export function uploadProgressLabel(items: PhotoUploadQueueItem[]): string | null {
  const active = countActiveUploads(items);
  const done = countDoneUploads(items);
  const errors = items.filter((i) => i.status === "error").length;
  if (active === 0 && done === 0 && errors === 0) return null;
  const total = items.length;
  if (active > 0) {
    return `${done} von ${total} hochgeladen · ${active} in Arbeit…`;
  }
  if (errors > 0) {
    return `${done} hochgeladen · ${errors} fehlgeschlagen`;
  }
  return `${done} Bild${done === 1 ? "" : "er"} hochgeladen`;
}
