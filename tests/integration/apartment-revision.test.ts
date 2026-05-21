import "../helpers/action-mocks-setup";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { updateApartmentNotesAction } from "@/app/actions";
import { APARTMENT_REVISION_FIELD } from "@/lib/apartment-revision";
import { catchRedirect, clearMockAuth, setMockUser } from "../helpers/action-mocks";
import {
  clearProjectData,
  createTestPrisma,
  createTestProject,
  resetTestDatabase,
  withIsolatedDataDir,
} from "../helpers/test-db";

describe("apartment revision conflicts", () => {
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

  beforeEach(async () => {
    clearMockAuth();
    const prisma = createTestPrisma();
    await clearProjectData(prisma);
    const user = await prisma.user.findUniqueOrThrow({ where: { username: "testuser" } });
    setMockUser(user);
    await prisma.$disconnect();
  });

  it("rejects save when revision is stale", async () => {
    const prisma = createTestPrisma();
    const user = await prisma.user.findUniqueOrThrow({ where: { username: "testuser" } });
    const project = await createTestProject(prisma, user.id);
    const apt = await prisma.apartment.create({
      data: { projectId: project.id, title: "Conflict test", revision: 0 },
    });

    await prisma.apartment.update({
      where: { id: apt.id },
      data: { notes: "Updated elsewhere", revision: 1 },
    });

    const form = new FormData();
    form.set(APARTMENT_REVISION_FIELD, "0");
    form.set("notes", "Stale save attempt");

    const { redirect: url } = await catchRedirect(() =>
      updateApartmentNotesAction(apt.id, form)
    );
    expect(url).toContain("conflict=1");

    const row = await prisma.apartment.findUniqueOrThrow({ where: { id: apt.id } });
    expect(row.notes).toBe("Updated elsewhere");
    expect(row.revision).toBe(1);
    await prisma.$disconnect();
  });

  it("increments revision on successful save", async () => {
    const prisma = createTestPrisma();
    const user = await prisma.user.findUniqueOrThrow({ where: { username: "testuser" } });
    const project = await createTestProject(prisma, user.id);
    const apt = await prisma.apartment.create({
      data: { projectId: project.id, title: "Revision bump", revision: 2 },
    });

    const form = new FormData();
    form.set(APARTMENT_REVISION_FIELD, "2");
    form.set("notes", "Saved");

    await catchRedirect(() => updateApartmentNotesAction(apt.id, form));

    const row = await prisma.apartment.findUniqueOrThrow({ where: { id: apt.id } });
    expect(row.notes).toBe("Saved");
    expect(row.revision).toBe(3);
    await prisma.$disconnect();
  });
});
