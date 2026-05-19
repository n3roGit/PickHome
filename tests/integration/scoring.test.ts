import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { apartmentScore } from "@/lib/project-data";
import {
  addTestProjectMember,
  clearProjectData,
  createTestPartner,
  createTestPrisma,
  createTestProject,
  resetTestDatabase,
  seedScoringTestCriteria,
} from "../helpers/test-db";

describe("scoring integration", () => {
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

  it("persists separate scores for two project members on one apartment", async () => {
    const prisma = createTestPrisma();
    const owner = await prisma.user.findUniqueOrThrow({ where: { username: "testuser" } });
    const partner = await createTestPartner(prisma, "jasmin", "Jasmin");
    const project = await createTestProject(prisma, owner.id);
    await addTestProjectMember(prisma, project.id, partner.id);
    const criteria = await seedScoringTestCriteria(prisma, project.id);

    const apartment = await prisma.apartment.create({
      data: { projectId: project.id, title: "Testwohnung" },
    });

    const [mustHave, nice] = criteria;

    await prisma.rating.createMany({
      data: [
        { apartmentId: apartment.id, criterionId: mustHave.id, userId: owner.id, score: 10 },
        { apartmentId: apartment.id, criterionId: nice.id, userId: owner.id, score: 10 },
        { apartmentId: apartment.id, criterionId: mustHave.id, userId: partner.id, score: 3 },
        { apartmentId: apartment.id, criterionId: nice.id, userId: partner.id, score: 10 },
      ],
    });

    const loaded = await prisma.apartment.findUniqueOrThrow({
      where: { id: apartment.id },
      include: { ratings: true },
    });

    const ownerScore = apartmentScore([...criteria], loaded.ratings, owner.id);
    const partnerScore = apartmentScore([...criteria], loaded.ratings, partner.id);

    expect(ownerScore.score).toBe(100);
    expect(ownerScore.dealbreaker).toBe(false);
    expect(partnerScore.score).toBe(0);
    expect(partnerScore.dealbreaker).toBe(true);

    await prisma.$disconnect();
  });

  it("upsert updates only the acting user's rating", async () => {
    const prisma = createTestPrisma();
    const owner = await prisma.user.findUniqueOrThrow({ where: { username: "testuser" } });
    const partner = await createTestPartner(prisma, "partner2");
    const project = await createTestProject(prisma, owner.id);
    await addTestProjectMember(prisma, project.id, partner.id);
    const criteria = await seedScoringTestCriteria(prisma, project.id);
    const apartment = await prisma.apartment.create({
      data: { projectId: project.id, title: "Upsert test" },
    });
    const [mustHave] = criteria;

    await prisma.rating.create({
      data: {
        apartmentId: apartment.id,
        criterionId: mustHave.id,
        userId: owner.id,
        score: 8,
      },
    });

    await prisma.rating.upsert({
      where: {
        apartmentId_criterionId_userId: {
          apartmentId: apartment.id,
          criterionId: mustHave.id,
          userId: partner.id,
        },
      },
      create: {
        apartmentId: apartment.id,
        criterionId: mustHave.id,
        userId: partner.id,
        score: 3,
      },
      update: { score: 3 },
    });

    const loaded = await prisma.apartment.findUniqueOrThrow({
      where: { id: apartment.id },
      include: { ratings: true },
    });

    expect(apartmentScore([...criteria], loaded.ratings, owner.id).score).toBe(80);
    expect(apartmentScore([...criteria], loaded.ratings, partner.id).dealbreaker).toBe(true);
    expect(apartmentScore([...criteria], loaded.ratings, partner.id).score).toBe(0);

    await prisma.$disconnect();
  });

  it("scores two apartments with different ratings for ranking", async () => {
    const prisma = createTestPrisma();
    const user = await prisma.user.findUniqueOrThrow({ where: { username: "testuser" } });
    const project = await createTestProject(prisma, user.id);
    const criteria = await seedScoringTestCriteria(prisma, project.id);
    const [mustHave, nice] = criteria;

    const aptStrong = await prisma.apartment.create({
      data: { projectId: project.id, title: "Strong" },
    });
    const aptWeak = await prisma.apartment.create({
      data: { projectId: project.id, title: "Weak" },
    });

    for (const apt of [aptStrong, aptWeak]) {
      await prisma.rating.createMany({
        data: [
          {
            apartmentId: apt.id,
            criterionId: mustHave.id,
            userId: user.id,
            score: apt === aptStrong ? 9 : 6,
          },
          {
            apartmentId: apt.id,
            criterionId: nice.id,
            userId: user.id,
            score: apt === aptStrong ? 8 : 5,
          },
        ],
      });
    }

    const strong = await prisma.apartment.findUniqueOrThrow({
      where: { id: aptStrong.id },
      include: { ratings: true },
    });
    const weak = await prisma.apartment.findUniqueOrThrow({
      where: { id: aptWeak.id },
      include: { ratings: true },
    });

    const strongScore = apartmentScore([...criteria], strong.ratings, user.id).score;
    const weakScore = apartmentScore([...criteria], weak.ratings, user.id).score;

    expect(strongScore).toBeGreaterThan(weakScore);
    expect(strongScore).toBeGreaterThan(70);

    await prisma.$disconnect();
  });
});
