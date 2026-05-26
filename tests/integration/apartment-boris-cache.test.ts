import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  clearProjectData,
  createTestPrisma,
  createTestProject,
  resetTestDatabase,
} from "../helpers/test-db";

describe("apartment boris cache integration", () => {
  beforeAll(async () => {
    await resetTestDatabase();
  });

  afterAll(async () => {
    const prisma = createTestPrisma();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    const prisma = createTestPrisma();
    await clearProjectData(prisma);
    await prisma.$disconnect();
  });

  it("persists cache rows and deletes them with the apartment", async () => {
    const prisma = createTestPrisma();
    const user = await prisma.user.findUniqueOrThrow({ where: { username: "testuser" } });
    const project = await createTestProject(prisma, user.id);
    const apartment = await prisma.apartment.create({
      data: {
        projectId: project.id,
        title: "Apt",
        latitude: 53.085,
        longitude: 8.836,
      },
    });

    await prisma.apartmentBorisCache.create({
      data: {
        apartmentId: apartment.id,
        status: "ok",
        resultsJson: JSON.stringify([{ brwEurPerSqm: 790 }]),
      },
    });

    const cached = await prisma.apartmentBorisCache.findUnique({
      where: { apartmentId: apartment.id },
    });
    expect(cached?.status).toBe("ok");

    await prisma.apartment.delete({ where: { id: apartment.id } });

    const afterDelete = await prisma.apartmentBorisCache.findUnique({
      where: { apartmentId: apartment.id },
    });
    expect(afterDelete).toBeNull();
    await prisma.$disconnect();
  });
});
