import { describe, expect, it } from "vitest";
import {
  countActiveUploads,
  countDoneUploads,
  type PhotoUploadQueueItem,
  uploadProgressLabel,
} from "@/lib/photo-upload-queue";

function item(status: PhotoUploadQueueItem["status"]): PhotoUploadQueueItem {
  return {
    id: "1",
    file: new File([], "a.jpg"),
    fileName: "a.jpg",
    previewUrl: "blob:x",
    status,
  };
}

describe("photo-upload-queue", () => {
  it("counts active uploads", () => {
    expect(countActiveUploads([item("queued"), item("uploading")])).toBe(2);
    expect(countActiveUploads([item("done"), item("error")])).toBe(0);
  });

  it("builds progress label", () => {
    expect(uploadProgressLabel([])).toBeNull();
    expect(uploadProgressLabel([item("queued"), item("done")])).toMatch(/1 von 2/);
    expect(uploadProgressLabel([item("done"), item("error")])).toMatch(/fehlgeschlagen/);
  });

  it("counts done uploads", () => {
    expect(countDoneUploads([item("done"), item("queued")])).toBe(1);
  });
});
