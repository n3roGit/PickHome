import { access, readFile, rm, writeFile } from "fs/promises";
import { join } from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import AdmZip from "adm-zip";
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  exportBackupToBuffer,
  getDatabaseFilePath,
  importBackupFromBuffer,
  parseManifest,
} from "@/lib/backup";
import { publicPhotoPath } from "@/lib/pickhome-data";
import { prisma } from "@/lib/prisma";
import { saveApartmentPhoto } from "@/lib/apartment-media";
import {
  createTestPrisma,
  createTestProject,
  resetTestDatabase,
  withIsolatedDataDir,
} from "../helpers/test-db";
import { mockJpegFile } from "../helpers/mock-image-file";

describe("backup roundtrip", () => {
  let dataDir: ReturnType<typeof withIsolatedDataDir>;

  beforeAll(async () => {
    await resetTestDatabase();
    dataDir = withIsolatedDataDir();
  });

  afterAll(async () => {
    dataDir.restore();
    await prisma.$disconnect();
  });

  it("export and import restores DB rows and upload files", async () => {
    const testPrisma = createTestPrisma();
    const user = await testPrisma.user.findUniqueOrThrow({ where: { username: "testuser" } });
    const project = await createTestProject(testPrisma, user.id);
    const apt = await testPrisma.apartment.create({
      data: {
        projectId: project.id,
        title: "Backup Apt",
        address: "Bremen",
        latitude: 53.08,
        longitude: 8.8,
      },
    });
    const file = mockJpegFile("p.jpg");
    const { url, thumbUrl } = await saveApartmentPhoto(apt.id, file);
    await testPrisma.apartmentPhoto.create({
      data: { apartmentId: apt.id, url, thumbUrl, sortOrder: 0 },
    });
    await testPrisma.$disconnect();

    const zipBuffer = await exportBackupToBuffer();
    const photoPath = publicPhotoPath(url)!;

    await testPrisma.$disconnect();
    await prisma.$disconnect();
    await rm(photoPath, { force: true });
    await rm(getDatabaseFilePath(), { force: true });

    await importBackupFromBuffer(zipBuffer);

    const after = createTestPrisma();
    const restoredApt = await after.apartment.findFirst({
      where: { title: "Backup Apt" },
      include: { photos: true },
    });
    expect(restoredApt?.latitude).toBe(53.08);
    expect(restoredApt?.photos).toHaveLength(1);
    expect(restoredApt?.photos[0]?.thumbUrl).toMatch(/-thumb\.webp$/);
    await access(publicPhotoPath(restoredApt!.photos[0].url)!);
    if (restoredApt?.photos[0]?.thumbUrl) {
      await access(publicPhotoPath(restoredApt.photos[0].thumbUrl)!);
    }
    await after.$disconnect();
  });

  it("parseManifest rejects invalid archives", () => {
    expect(() =>
      parseManifest(JSON.stringify({ format: "other", version: 1, exportedAt: "", appVersion: "" }))
    ).toThrow(/Invalid backup format/);

    expect(() =>
      parseManifest(
        JSON.stringify({
          format: BACKUP_FORMAT,
          version: BACKUP_VERSION + 99,
          exportedAt: "",
          appVersion: "",
        })
      )
    ).toThrow(/Unsupported backup version/);
  });

  it("rejects zip missing manifest or database", async () => {
    const badZipPath = join(dataDir.dir, "bad.zip");
    const zip = new AdmZip();
    zip.addFile("readme.txt", Buffer.from("nope"));
    zip.writeZip(badZipPath);
    const buffer = await readFile(badZipPath);

    await expect(importBackupFromBuffer(buffer)).rejects.toThrow(/missing manifest/i);
  });
});
