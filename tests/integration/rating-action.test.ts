import "../helpers/action-mocks-setup";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { saveRatingAction } from "@/app/actions";
import { clearMockAuth, setMockUser } from "../helpers/action-mocks";
import {
  clearProjectData,
  createTestPrisma,
  createTestProject,
  resetTestDatabase,
  seedScoringTestCriteria,
} from "../helpers/test-db";

describe("saveRatingAction", () => {
  beforeAll(async () => {
    await resetTestDatabase();
  });

  afterAll(async () => {
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

  it("upserts rating for project criterion", async () => {
    const prisma = createTestPrisma();
    const user = await prisma.user.findUniqueOrThrow({ where: { username: "testuser" } });
    const project = await createTestProject(prisma, user.id);
    const criteria = await seedScoringTestCriteria(prisma, project.id);
    const apt = await prisma.apartment.create({
      data: { projectId: project.id, title: "Rated" },
    });

    await saveRatingAction(apt.id, criteria[0].id, 8, "Good");
    await saveRatingAction(apt.id, criteria[0].id, 9);

    const rating = await prisma.rating.findUnique({
      where: {
        apartmentId_criterionId_userId: {
          apartmentId: apt.id,
          criterionId: criteria[0].id,
          userId: user.id,
        },
      },
    });
    expect(rating?.score).toBe(9);
    await prisma.$disconnect();
  });

  it("ignores invalid scores", async () => {
    const prisma = createTestPrisma();
    const user = await prisma.user.findUniqueOrThrow({ where: { username: "testuser" } });
    const project = await createTestProject(prisma, user.id);
    const criteria = await seedScoringTestCriteria(prisma, project.id);
    const apt = await prisma.apartment.create({
      data: { projectId: project.id, title: "Rated" },
    });

    await saveRatingAction(apt.id, criteria[0].id, 11);
    await saveRatingAction(apt.id, criteria[0].id, -1);
    await saveRatingAction(apt.id, criteria[0].id, 3.5);

    const count = await prisma.rating.count({ where: { apartmentId: apt.id } });
    expect(count).toBe(0);
    await prisma.$disconnect();
  });

  it("ignores criterion from another project", async () => {
    const prisma = createTestPrisma();
    const user = await prisma.user.findUniqueOrThrow({ where: { username: "testuser" } });
    const projectA = await createTestProject(prisma, user.id);
    const projectB = await createTestProject(prisma, user.id);
    const criteriaB = await seedScoringTestCriteria(prisma, projectB.id);
    const aptA = await prisma.apartment.create({
      data: { projectId: projectA.id, title: "A" },
    });

    await saveRatingAction(aptA.id, criteriaB[0].id, 7);
    const count = await prisma.rating.count({ where: { apartmentId: aptA.id } });
    expect(count).toBe(0);
    await prisma.$disconnect();
  });
});
