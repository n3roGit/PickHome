import { access } from "fs/promises";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { backfillPhotoThumbs } from "@/lib/backfill-photo-thumbs";
import { saveApartmentPhoto } from "@/lib/apartment-media";
import { publicPhotoPath } from "@/lib/pickhome-data";
import { createTestPrisma, createTestProject, resetTestDatabase, withIsolatedDataDir } from "../helpers/test-db";
import { mockJpegFile } from "../helpers/mock-image-file";

describe("backfill-photo-thumbs", () => {
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

  it("generates thumbUrl for photos missing thumbnails", async () => {
    const prisma = createTestPrisma();
    const user = await prisma.user.findUniqueOrThrow({ where: { username: "testuser" } });
    const project = await createTestProject(prisma, user.id);
    const apt = await prisma.apartment.create({
      data: { projectId: project.id, title: "Backfill apt" },
    });

    const file = mockJpegFile("old.jpg");
    const { url } = await saveApartmentPhoto(apt.id, file);
    await prisma.apartmentPhoto.create({
      data: { apartmentId: apt.id, url, thumbUrl: null, sortOrder: 0 },
    });

    const updated = await backfillPhotoThumbs();
    expect(updated).toBe(1);

    const photo = await prisma.apartmentPhoto.findFirstOrThrow({ where: { apartmentId: apt.id } });
    expect(photo.thumbUrl).toMatch(/-thumb\.webp$/);
    await access(publicPhotoPath(photo.thumbUrl!)!);

    await prisma.$disconnect();
  });
});
