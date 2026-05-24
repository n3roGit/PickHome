import { access, readFile } from "fs/promises";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  deleteApartmentPhotoFile,
  saveApartmentDocument,
  saveApartmentPhoto,
  thumbUrlFromPhotoUrl,
} from "@/lib/apartment-media";
import { getApartmentUploadsRoot } from "@/lib/pickhome-data";
import { MAX_DOCUMENT_BYTES, MAX_IMAGE_BYTES } from "@/lib/upload-limits";
import { mockJpegFile } from "../helpers/mock-image-file";
import { withIsolatedDataDir } from "../helpers/test-db";

function mockFile(name: string, type: string, size: number, content = "x") {
  if (type === "image/jpeg") {
    return mockJpegFile(name, size);
  }
  const buffer = Buffer.alloc(size, content.charCodeAt(0));
  return new File([buffer], name, { type });
}

describe("apartment-media", () => {
  let dataDir: ReturnType<typeof withIsolatedDataDir>;

  beforeEach(() => {
    dataDir = withIsolatedDataDir();
  });

  afterEach(() => {
    dataDir.restore();
  });

  it("saves a JPEG photo under uploads/apartments with thumbnail", async () => {
    const aptId = "apt-photo-1";
    const file = mockJpegFile("photo.jpg");
    const { url, thumbUrl } = await saveApartmentPhoto(aptId, file);
    expect(url).toMatch(/^\/uploads\/apartments\/apt-photo-1\/.+\.jpg$/);
    expect(thumbUrl).toBe(thumbUrlFromPhotoUrl(url));
    const diskPath = join(getApartmentUploadsRoot(), aptId, url.split("/").pop()!);
    await access(diskPath);
    const thumbPath = join(getApartmentUploadsRoot(), aptId, thumbUrl!.split("/").pop()!);
    await access(thumbPath);
    const thumbBytes = await readFile(thumbPath);
    expect(thumbBytes.length).toBeGreaterThan(0);
  });

  it("saves PNG photo with thumbnail", async () => {
    const aptId = "apt-photo-png";
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64"
    );
    const file = new File([png], "photo.png", { type: "image/png" });
    const { url, thumbUrl } = await saveApartmentPhoto(aptId, file);
    expect(url).toMatch(/\.png$/);
    expect(thumbUrl).toMatch(/-thumb\.webp$/);
    await access(join(getApartmentUploadsRoot(), aptId, thumbUrl!.split("/").pop()!));
  });

  it("saves HEIC photo without thumbnail when sharp cannot decode", async () => {
    const aptId = "apt-photo-heic";
    const file = mockFile("photo.heic", "image/heic", 64);
    const { url, thumbUrl } = await saveApartmentPhoto(aptId, file);
    expect(url).toMatch(/\.heic$/);
    expect(thumbUrl).toBeNull();
  });

  it("rejects invalid photo MIME", async () => {
    const file = mockFile("notes.txt", "text/plain", 50);
    await expect(saveApartmentPhoto("apt-1", file)).rejects.toThrow("invalid_type");
  });

  it("rejects oversized photos", async () => {
    const file = mockFile("big.jpg", "image/jpeg", MAX_IMAGE_BYTES + 1);
    await expect(saveApartmentPhoto("apt-1", file)).rejects.toThrow("too_large");
  });

  it("saves PDF documents with buffer", async () => {
    const aptId = "apt-doc-1";
    const file = mockFile("expose.pdf", "application/pdf", 200);
    const buffer = Buffer.from("%PDF-1.4 test");
    const saved = await saveApartmentDocument(aptId, file, buffer);
    expect(saved.url).toContain("/documents/");
    expect(saved.mimeType).toBe("application/pdf");
    const filename = saved.url.split("/").pop()!;
    const disk = await readFile(join(getApartmentUploadsRoot(), aptId, "documents", filename));
    expect(disk.toString()).toContain("%PDF");
  });

  it("rejects non-PDF documents", async () => {
    const file = mockFile("image.png", "image/png", 100);
    await expect(saveApartmentDocument("apt-1", file)).rejects.toThrow("invalid_type");
  });

  it("rejects oversized PDF documents", async () => {
    const file = mockFile("big.pdf", "application/pdf", 100);
    const buffer = Buffer.alloc(MAX_DOCUMENT_BYTES + 1);
    await expect(saveApartmentDocument("apt-1", file, buffer)).rejects.toThrow("too_large");
  });

  it("deleteApartmentPhotoFile removes original and thumbnail from disk", async () => {
    const aptId = "apt-del";
    const { url, thumbUrl } = await saveApartmentPhoto(aptId, mockJpegFile("x.jpg", 50));
    await deleteApartmentPhotoFile(url, thumbUrl);
    const diskPath = join(getApartmentUploadsRoot(), aptId, url.split("/").pop()!);
    await expect(access(diskPath)).rejects.toThrow();
    if (thumbUrl) {
      const thumbPath = join(getApartmentUploadsRoot(), aptId, thumbUrl.split("/").pop()!);
      await expect(access(thumbPath)).rejects.toThrow();
    }
  });

  it("ignores delete for non-upload URLs", async () => {
    await expect(deleteApartmentPhotoFile("/other/path.jpg")).resolves.toBeUndefined();
  });
});
