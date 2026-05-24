import "../helpers/action-mocks-setup";
import { access, readFile } from "fs/promises";
import { join } from "path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { uploadApartmentDocumentAction } from "@/app/actions";
import {
  deleteApartmentPhotoAction,
  uploadApartmentPhotoAction,
} from "@/app/apartment-photo-actions";
import { publicPhotoPath } from "@/lib/pickhome-data";
import { MAX_DOCUMENT_BYTES, MAX_IMAGE_BYTES } from "@/lib/upload-limits";
import { clearMockAuth, setMockUser } from "../helpers/action-mocks";
import {
  clearProjectData,
  createTestPrisma,
  createTestProject,
  resetTestDatabase,
  withIsolatedDataDir,
} from "../helpers/test-db";

vi.mock("@/lib/pdf-text", () => ({
  extractPdfText: vi.fn(async () => "Sample PDF text for search"),
}));

import {
  createTestPrisma,
  createTestProject,
  resetTestDatabase,
  withIsolatedDataDir,
} from "../helpers/test-db";
import { mockJpegFile } from "../helpers/mock-image-file";

function mockFile(name: string, type: string, size: number) {
  if (type === "image/jpeg") {
    return mockJpegFile(name, size);
  }
  return new File([Buffer.alloc(size, 0x41)], name, { type });
}

describe("upload server actions", () => {
  let dataDir: ReturnType<typeof withIsolatedDataDir>;

  beforeAll(async () => {
    await resetTestDatabase();
    dataDir = withIsolatedDataDir();
  });

  afterAll(async () => {
    dataDir.restore();
    const prisma = createTestPrisma();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    clearMockAuth();
    const prisma = createTestPrisma();
    await clearProjectData(prisma);
    const user = await prisma.user.findUniqueOrThrow({ where: { username: "testuser" } });
    setMockUser(user);
    await prisma.$disconnect();
  });

  it("uploadApartmentPhotoAction stores file and DB row", async () => {
    const prisma = createTestPrisma();
    const user = await prisma.user.findUniqueOrThrow({ where: { username: "testuser" } });
    const project = await createTestProject(prisma, user.id);
    const apt = await prisma.apartment.create({
      data: { projectId: project.id, title: "Photos" },
    });

    const form = new FormData();
    form.set("photo", mockFile("room.jpg", "image/jpeg", 500));

    const result = await uploadApartmentPhotoAction(apt.id, form);
    expect(result).toEqual({ ok: true });

    const photo = await prisma.apartmentPhoto.findFirst({ where: { apartmentId: apt.id } });
    expect(photo?.sortOrder).toBe(0);
    expect(photo?.thumbUrl).toMatch(/-thumb\.webp$/);
    const disk = publicPhotoPath(photo!.url);
    expect(disk).not.toBeNull();
    await access(disk!);
    if (photo?.thumbUrl) {
      await access(publicPhotoPath(photo.thumbUrl)!);
    }
    await prisma.$disconnect();
  });

  it("rejects invalid photo type", async () => {
    const prisma = createTestPrisma();
    const user = await prisma.user.findUniqueOrThrow({ where: { username: "testuser" } });
    const project = await createTestProject(prisma, user.id);
    const apt = await prisma.apartment.create({
      data: { projectId: project.id, title: "Photos" },
    });

    const form = new FormData();
    form.set("photo", mockFile("notes.txt", "text/plain", 50));

    const result = await uploadApartmentPhotoAction(apt.id, form);
    expect(result).toEqual({ ok: false, error: "invalid_type" });
    await prisma.$disconnect();
  });

  it("ignores empty photo upload", async () => {
    const prisma = createTestPrisma();
    const user = await prisma.user.findUniqueOrThrow({ where: { username: "testuser" } });
    const project = await createTestProject(prisma, user.id);
    const apt = await prisma.apartment.create({
      data: { projectId: project.id, title: "Photos" },
    });

    const form = new FormData();
    const result = await uploadApartmentPhotoAction(apt.id, form);
    expect(result).toBeUndefined();
    const count = await prisma.apartmentPhoto.count({ where: { apartmentId: apt.id } });
    expect(count).toBe(0);
    await prisma.$disconnect();
  });

  it("assigns sortOrder for second photo", async () => {
    const prisma = createTestPrisma();
    const user = await prisma.user.findUniqueOrThrow({ where: { username: "testuser" } });
    const project = await createTestProject(prisma, user.id);
    const apt = await prisma.apartment.create({
      data: { projectId: project.id, title: "Photos" },
    });

    const form1 = new FormData();
    form1.set("photo", mockFile("one.jpg", "image/jpeg", 500));
    await uploadApartmentPhotoAction(apt.id, form1);

    const form2 = new FormData();
    form2.set("photo", mockFile("two.jpg", "image/jpeg", 500));
    await uploadApartmentPhotoAction(apt.id, form2);

    const photos = await prisma.apartmentPhoto.findMany({
      where: { apartmentId: apt.id },
      orderBy: { sortOrder: "asc" },
    });
    expect(photos).toHaveLength(2);
    expect(photos[0]?.sortOrder).toBe(0);
    expect(photos[1]?.sortOrder).toBe(1);
    await prisma.$disconnect();
  });

  it("rejects oversized photo upload", async () => {
    const prisma = createTestPrisma();
    const user = await prisma.user.findUniqueOrThrow({ where: { username: "testuser" } });
    const project = await createTestProject(prisma, user.id);
    const apt = await prisma.apartment.create({
      data: { projectId: project.id, title: "Photos" },
    });

    const form = new FormData();
    form.set("photo", mockFile("big.jpg", "image/jpeg", MAX_IMAGE_BYTES + 1));

    const result = await uploadApartmentPhotoAction(apt.id, form);
    expect(result).toEqual({ ok: false, error: "too_large" });
    await prisma.$disconnect();
  });

  it("uploadApartmentDocumentAction stores PDF with extracted text", async () => {
    const prisma = createTestPrisma();
    const user = await prisma.user.findUniqueOrThrow({ where: { username: "testuser" } });
    const project = await createTestProject(prisma, user.id);
    const apt = await prisma.apartment.create({
      data: { projectId: project.id, title: "Docs" },
    });

    const form = new FormData();
    form.set("document", mockFile("expose.pdf", "application/pdf", 300));

    const result = await uploadApartmentDocumentAction(apt.id, form);
    expect(result).toEqual({ ok: true });

    const doc = await prisma.apartmentDocument.findFirst({ where: { apartmentId: apt.id } });
    expect(doc?.extractedText).toContain("Sample PDF");
    expect(doc?.mimeType).toBe("application/pdf");
    const disk = publicPhotoPath(doc!.url);
    const bytes = await readFile(disk!);
    expect(bytes.length).toBeGreaterThan(0);
    await prisma.$disconnect();
  });

  it("rejects invalid document type", async () => {
    const prisma = createTestPrisma();
    const user = await prisma.user.findUniqueOrThrow({ where: { username: "testuser" } });
    const project = await createTestProject(prisma, user.id);
    const apt = await prisma.apartment.create({
      data: { projectId: project.id, title: "Docs" },
    });

    const form = new FormData();
    form.set("document", mockFile("notes.txt", "text/plain", 50));

    const result = await uploadApartmentDocumentAction(apt.id, form);
    expect(result).toEqual({ ok: false, error: "invalid_type" });
    await prisma.$disconnect();
  });

  it("rejects oversized PDF upload", async () => {
    const prisma = createTestPrisma();
    const user = await prisma.user.findUniqueOrThrow({ where: { username: "testuser" } });
    const project = await createTestProject(prisma, user.id);
    const apt = await prisma.apartment.create({
      data: { projectId: project.id, title: "Docs" },
    });

    const form = new FormData();
    form.set("document", mockFile("big.pdf", "application/pdf", MAX_DOCUMENT_BYTES + 1));

    const result = await uploadApartmentDocumentAction(apt.id, form);
    expect(result).toEqual({ ok: false, error: "too_large" });
    await prisma.$disconnect();
  });

  it("deleteApartmentPhotoAction removes DB row and file", async () => {
    const prisma = createTestPrisma();
    const user = await prisma.user.findUniqueOrThrow({ where: { username: "testuser" } });
    const project = await createTestProject(prisma, user.id);
    const apt = await prisma.apartment.create({
      data: { projectId: project.id, title: "Photos" },
    });

    const form = new FormData();
    form.set("photo", mockFile("del.jpg", "image/jpeg", 80));
    await uploadApartmentPhotoAction(apt.id, form);
    const photo = await prisma.apartmentPhoto.findFirstOrThrow({
      where: { apartmentId: apt.id },
    });
    const disk = publicPhotoPath(photo.url)!;

    await deleteApartmentPhotoAction(photo.id);
    const gone = await prisma.apartmentPhoto.findUnique({ where: { id: photo.id } });
    expect(gone).toBeNull();
    await expect(access(disk)).rejects.toThrow();
    if (photo.thumbUrl) {
      await expect(access(publicPhotoPath(photo.thumbUrl)!)).rejects.toThrow();
    }
    await prisma.$disconnect();
  });
});
