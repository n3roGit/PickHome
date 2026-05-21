import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  applyApartmentPriceUpdate,
  PRICE_HISTORY_SOURCE_MANUAL,
} from "@/lib/apartment-price-history";
import { apartmentScore } from "@/lib/project-data";
import {
  assertTestApartmentAccess,
  clearProjectData,
  createTestPrisma,
  createTestProject,
  resetTestDatabase,
  seedTestProjectCriteria,
  syncTestApartmentViewedAt,
} from "../helpers/test-db";

describe("database integration", () => {
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

  it("creates project with criteria and scores an apartment", async () => {
    const prisma = createTestPrisma();
    const user = await prisma.user.findUniqueOrThrow({ where: { username: "testuser" } });
    const project = await createTestProject(prisma, user.id);
    await seedTestProjectCriteria(prisma, project.id);

    const groups = await prisma.criterionGroup.findMany({
      where: { projectId: project.id },
      include: { criteria: true },
    });
    const criteria = groups.flatMap((g) =>
      g.criteria.map((c) => ({
        id: c.id,
        weight: c.weight,
        isDealbreaker: c.isDealbreaker,
      }))
    );
    expect(criteria.length).toBeGreaterThan(0);

    const apartment = await prisma.apartment.create({
      data: {
        projectId: project.id,
        title: "Teststraße 1",
        price: 250_000,
      },
    });

    for (const c of criteria.slice(0, 3)) {
      await prisma.rating.create({
        data: {
          apartmentId: apartment.id,
          criterionId: c.id,
          userId: user.id,
          score: 8,
        },
      });
    }

    const loaded = await prisma.apartment.findUniqueOrThrow({
      where: { id: apartment.id },
      include: { ratings: true },
    });

    const score = apartmentScore(criteria, loaded.ratings, user.id);
    expect(score.rated).toBe(3);
    expect(score.score).toBeGreaterThan(0);
    await prisma.$disconnect();
  });

  it("syncs viewedAt from past viewings", async () => {
    const prisma = createTestPrisma();
    const user = await prisma.user.findUniqueOrThrow({ where: { username: "testuser" } });
    const project = await createTestProject(prisma, user.id);
    const apartment = await prisma.apartment.create({
      data: { projectId: project.id, title: "Viewing Test" },
    });

    await prisma.viewingAppointment.createMany({
      data: [
        {
          apartmentId: apartment.id,
          scheduledAt: new Date("2026-05-10T10:00:00"),
        },
        {
          apartmentId: apartment.id,
          scheduledAt: new Date("2026-05-15T14:00:00"),
        },
        {
          apartmentId: apartment.id,
          scheduledAt: new Date("2026-12-01T10:00:00"),
        },
      ],
    });

    await syncTestApartmentViewedAt(prisma, apartment.id);

    const updated = await prisma.apartment.findUniqueOrThrow({
      where: { id: apartment.id },
    });
    expect(updated.viewedAt?.toISOString()).toBe(
      new Date("2026-05-15T14:00:00").toISOString()
    );
    await prisma.$disconnect();
  });

  it("restricts apartment access to project members", async () => {
    const prisma = createTestPrisma();
    const owner = await prisma.user.findUniqueOrThrow({ where: { username: "testuser" } });
    const outsider = await prisma.user.create({
      data: {
        username: "outsider",
        name: "Outsider",
        passwordHash: "x",
        role: "USER",
      },
    });
    const project = await createTestProject(prisma, owner.id);
    const apartment = await prisma.apartment.create({
      data: { projectId: project.id, title: "Private" },
    });

    expect(await assertTestApartmentAccess(prisma, apartment.id, owner.id)).toMatchObject({
      id: apartment.id,
      projectId: project.id,
    });
    expect(await assertTestApartmentAccess(prisma, apartment.id, outsider.id)).toBeNull();
    await prisma.$disconnect();
  });

  it("records apartment price history on update", async () => {
    const prisma = createTestPrisma();
    const user = await prisma.user.findUniqueOrThrow({ where: { username: "testuser" } });
    const project = await createTestProject(prisma, user.id);
    const apartment = await prisma.apartment.create({
      data: { projectId: project.id, title: "Price test", price: 300_000 },
    });

    await applyApartmentPriceUpdate(apartment.id, 320_000, PRICE_HISTORY_SOURCE_MANUAL);

    const updated = await prisma.apartment.findUniqueOrThrow({ where: { id: apartment.id } });
    expect(updated.price).toBe(320_000);

    const history = await prisma.apartmentPriceHistory.findMany({
      where: { apartmentId: apartment.id },
      orderBy: { recordedAt: "desc" },
    });
    expect(history).toHaveLength(1);
    expect(history[0].price).toBe(320_000);
    expect(history[0].previousPrice).toBe(300_000);
    expect(history[0].source).toBe(PRICE_HISTORY_SOURCE_MANUAL);

    const unchanged = await applyApartmentPriceUpdate(
      apartment.id,
      320_000,
      PRICE_HISTORY_SOURCE_MANUAL
    );
    expect(unchanged.changed).toBe(false);
    expect(await prisma.apartmentPriceHistory.count({ where: { apartmentId: apartment.id } })).toBe(
      1
    );
    await prisma.$disconnect();
  });
});
