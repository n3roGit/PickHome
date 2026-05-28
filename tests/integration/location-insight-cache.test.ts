import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  clearProjectData,
  createTestPrisma,
  createTestProject,
  resetTestDatabase,
} from "../helpers/test-db";
import { getOrFetchLocationInsight } from "@/lib/location-insight-cache";

describe("location insight cache integration", () => {
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
        title: "Loc Apt",
        latitude: 52.52,
        longitude: 13.405,
      },
    });

    await getOrFetchLocationInsight(prisma, apartment.id, "flood", async () => ({
      ok: true,
      data: {
        scenarios: {
          HQhaeufig: "nicht_betroffen",
          HQ100: "nicht_betroffen",
          HQextrem: "nicht_betroffen",
        },
        detailLines: [],
      },
    }));

    const cached = await prisma.apartmentLocationInsightCache.findMany({
      where: { apartmentId: apartment.id },
    });
    expect(cached).toHaveLength(1);
    expect(cached[0]?.domain).toBe("flood");

    await prisma.apartment.delete({ where: { id: apartment.id } });
    const after = await prisma.apartmentLocationInsightCache.findMany({
      where: { apartmentId: apartment.id },
    });
    expect(after).toHaveLength(0);
    await prisma.$disconnect();
  });
});
