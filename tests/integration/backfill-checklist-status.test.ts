import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { backfillChecklistStatus } from "@/lib/backfill-checklist-status";
import {
  clearProjectData,
  createTestPrisma,
  resetTestDatabase,
} from "../helpers/test-db";

describe("backfillChecklistStatus", () => {
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

  it("maps open to not_ok and na to unset", async () => {
    const prisma = createTestPrisma();
    const user = await prisma.user.findUniqueOrThrow({ where: { username: "testuser" } });
    const project = await prisma.project.create({
      data: {
        name: "Backfill test",
        members: { create: { userId: user.id, role: "owner" } },
        groups: {
          create: {
            name: "G",
            criteria: { create: { name: "C", weight: 1 } },
          },
        },
      },
      include: { groups: { include: { criteria: true } } },
    });
    const apt = await prisma.apartment.create({
      data: { projectId: project.id, title: "Apt" },
    });
    const criterion = project.groups[0].criteria[0];
    const item = await prisma.checklistItem.create({
      data: {
        projectId: project.id,
        criterionGroupId: project.groups[0].id,
        criterionId: criterion.id,
      },
    });
    await prisma.checklistEntry.create({
      data: { apartmentId: apt.id, itemId: item.id, status: "open" },
    });
    const item2 = await prisma.checklistItem.create({
      data: {
        projectId: project.id,
        criterionGroupId: project.groups[0].id,
        name: "Extra",
      },
    });
    await prisma.checklistEntry.create({
      data: { apartmentId: apt.id, itemId: item2.id, status: "na", note: "keep" },
    });

    const updated = await backfillChecklistStatus();
    expect(updated).toBe(2);

    const entries = await prisma.checklistEntry.findMany({
      where: { apartmentId: apt.id },
    });
    expect(entries.find((e) => e.itemId === item.id)?.status).toBe("not_ok");
    const naEntry = entries.find((e) => e.itemId === item2.id);
    expect(naEntry?.status).toBe("unset");
    expect(naEntry?.note).toBe("keep");

    expect(await backfillChecklistStatus()).toBe(0);
    await prisma.$disconnect();
  });
});
