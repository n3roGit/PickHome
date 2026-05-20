import "../helpers/action-mocks-setup";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  addViewingAction,
  deleteViewingAction,
  updateViewingAction,
} from "@/app/actions";
import { clearMockAuth, setMockUser } from "../helpers/action-mocks";
import {
  clearProjectData,
  createTestPrisma,
  createTestProject,
  resetTestDatabase,
} from "../helpers/test-db";

describe("viewing server actions", () => {
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

  it("syncs viewedAt from latest past viewing", async () => {
    const prisma = createTestPrisma();
    const user = await prisma.user.findUniqueOrThrow({ where: { username: "testuser" } });
    const project = await createTestProject(prisma, user.id);
    const apt = await prisma.apartment.create({
      data: { projectId: project.id, title: "View" },
    });

    const past = new Date(Date.now() - 86_400_000);
    const form = new FormData();
    form.set("scheduledAt", past.toISOString());
    form.set("note", "First look");

    await addViewingAction(apt.id, form);
    const row = await prisma.apartment.findUniqueOrThrow({ where: { id: apt.id } });
    expect(row.viewedAt?.getTime()).toBe(past.getTime());
    await prisma.$disconnect();
  });

  it("clears viewedAt when past viewings are deleted", async () => {
    const prisma = createTestPrisma();
    const user = await prisma.user.findUniqueOrThrow({ where: { username: "testuser" } });
    const project = await createTestProject(prisma, user.id);
    const apt = await prisma.apartment.create({
      data: { projectId: project.id, title: "View" },
    });
    const viewing = await prisma.viewingAppointment.create({
      data: {
        apartmentId: apt.id,
        scheduledAt: new Date(Date.now() - 60_000),
      },
    });
    await prisma.apartment.update({
      where: { id: apt.id },
      data: { viewedAt: viewing.scheduledAt },
    });

    await deleteViewingAction(viewing.id);
    const row = await prisma.apartment.findUniqueOrThrow({ where: { id: apt.id } });
    expect(row.viewedAt).toBeNull();
    await prisma.$disconnect();
  });

  it("updateViewingAction changes schedule and viewedAt", async () => {
    const prisma = createTestPrisma();
    const user = await prisma.user.findUniqueOrThrow({ where: { username: "testuser" } });
    const project = await createTestProject(prisma, user.id);
    const apt = await prisma.apartment.create({
      data: { projectId: project.id, title: "View" },
    });
    const viewing = await prisma.viewingAppointment.create({
      data: {
        apartmentId: apt.id,
        scheduledAt: new Date(Date.now() + 86_400_000),
      },
    });

    const newPast = new Date(Date.now() - 120_000);
    const form = new FormData();
    form.set("scheduledAt", newPast.toISOString());
    form.set("note", "Rescheduled");

    await updateViewingAction(viewing.id, form);
    const row = await prisma.apartment.findUniqueOrThrow({ where: { id: apt.id } });
    expect(row.viewedAt?.getTime()).toBe(newPast.getTime());
    await prisma.$disconnect();
  });
});
