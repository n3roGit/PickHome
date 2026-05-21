import "../helpers/action-mocks-setup";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  toggleChecklistCriterionAction,
  saveChecklistEntryAction,
  addChecklistCustomItemAction,
} from "@/app/checklist-actions";
import { clearMockAuth, setMockUser } from "../helpers/action-mocks";
import {
  clearProjectData,
  createTestPrisma,
  createTestProject,
  resetTestDatabase,
  seedScoringTestCriteria,
} from "../helpers/test-db";

describe("checklist actions", () => {
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

  it("toggle criterion creates checklist item and save entry", async () => {
    const prisma = createTestPrisma();
    const user = await prisma.user.findUniqueOrThrow({ where: { username: "testuser" } });
    const project = await createTestProject(prisma, user.id);
    const criteria = await seedScoringTestCriteria(prisma, project.id);
    const apartment = await prisma.apartment.create({
      data: { projectId: project.id, title: "Test Apt" },
    });

    await toggleChecklistCriterionAction(project.id, criteria[0].id, true);

    const item = await prisma.checklistItem.findUnique({
      where: { criterionId: criteria[0].id },
    });
    expect(item).toBeTruthy();

    await saveChecklistEntryAction(apartment.id, item!.id, "ok", "Good heating");

    const entry = await prisma.checklistEntry.findUnique({
      where: { apartmentId_itemId: { apartmentId: apartment.id, itemId: item!.id } },
    });
    expect(entry?.note).toBe("Good heating");
    expect(entry?.status).toBe("ok");
    await prisma.$disconnect();
  });

  it("adds custom checklist item", async () => {
    const prisma = createTestPrisma();
    const user = await prisma.user.findUniqueOrThrow({ where: { username: "testuser" } });
    const project = await createTestProject(prisma, user.id);
    const group = await prisma.criterionGroup.create({
      data: { projectId: project.id, name: "Tech", sortOrder: 0 },
    });

    await addChecklistCustomItemAction(project.id, group.id, "Server room");

    const custom = await prisma.checklistItem.findFirst({
      where: { projectId: project.id, criterionId: null },
    });
    expect(custom?.name).toBe("Server room");
    await prisma.$disconnect();
  });
});
