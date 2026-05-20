import "../helpers/action-mocks-setup";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { createApartmentAction } from "@/app/actions";
import { ROLE_ADMIN } from "@/lib/auth";
import { assertProjectAccess } from "@/lib/project-data";
import { catchRedirect, clearMockAuth, setMockUser } from "../helpers/action-mocks";
import {
  clearProjectData,
  createTestPrisma,
  createTestProject,
  resetTestDatabase,
} from "../helpers/test-db";

describe("admin project access", () => {
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
    await prisma.$disconnect();
  });

  it("assertProjectAccess allows admin without project membership", async () => {
    const prisma = createTestPrisma();
    const owner = await prisma.user.findUniqueOrThrow({ where: { username: "testuser" } });
    const admin = await prisma.user.create({
      data: {
        username: "adminuser",
        name: "Admin",
        passwordHash: await bcrypt.hash("pass", 10),
        role: ROLE_ADMIN,
      },
    });
    const project = await createTestProject(prisma, owner.id);

    const access = await assertProjectAccess(project.id, admin);
    expect(access).toEqual({ id: project.id });

    await prisma.$disconnect();
  });

  it("createApartmentAction works for admin on foreign project", async () => {
    const prisma = createTestPrisma();
    const owner = await prisma.user.findUniqueOrThrow({ where: { username: "testuser" } });
    const admin = await prisma.user.create({
      data: {
        username: "adminuser2",
        name: "Admin Two",
        passwordHash: await bcrypt.hash("pass", 10),
        role: ROLE_ADMIN,
      },
    });
    const project = await createTestProject(prisma, owner.id);
    setMockUser(admin);

    const form = new FormData();
    form.set("title", "Admin listing");

    await catchRedirect(() => createApartmentAction(project.id, form));

    const count = await prisma.apartment.count({ where: { projectId: project.id } });
    expect(count).toBe(1);

    await prisma.$disconnect();
  });
});
