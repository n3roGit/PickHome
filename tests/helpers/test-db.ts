import { execSync } from "child_process";
import { existsSync, mkdirSync, unlinkSync } from "fs";
import { join } from "path";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { ROLE_USER } from "@/lib/auth";
import { DEFAULT_CRITERIA_GROUPS } from "@/lib/defaults";

export const TEST_DB_PATH = join(process.cwd(), "data", "test.db");
export const TEST_DATABASE_URL = `file:${TEST_DB_PATH.replace(/\\/g, "/")}`;

export function createTestPrisma() {
  return new PrismaClient({
    datasources: { db: { url: TEST_DATABASE_URL } },
  });
}

export async function resetTestDatabase() {
  mkdirSync(join(process.cwd(), "data"), { recursive: true });
  if (existsSync(TEST_DB_PATH)) {
    unlinkSync(TEST_DB_PATH);
  }
  execSync("npx prisma db push --skip-generate", {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
  });

  const prisma = createTestPrisma();
  await prisma.user.create({
    data: {
      username: "testuser",
      name: "Test User",
      passwordHash: await bcrypt.hash("testpass", 10),
      role: ROLE_USER,
    },
  });
  await prisma.$disconnect();
}

export async function createTestProject(prisma: PrismaClient, userId: string) {
  return prisma.project.create({
    data: {
      name: "Test Project",
      budget: 300_000,
      members: { create: { userId, role: "owner" } },
    },
  });
}

export async function seedTestProjectCriteria(prisma: PrismaClient, projectId: string) {
  let groupOrder = 0;
  for (const g of DEFAULT_CRITERIA_GROUPS) {
    const group = await prisma.criterionGroup.create({
      data: { projectId, name: g.name, sortOrder: groupOrder++ },
    });
    let critOrder = 0;
    for (const c of g.criteria) {
      await prisma.criterion.create({
        data: {
          groupId: group.id,
          name: c.name,
          weight: c.weight,
          isDealbreaker: c.isDealbreaker ?? false,
          sortOrder: critOrder++,
        },
      });
    }
  }
}

export async function syncTestApartmentViewedAt(
  prisma: PrismaClient,
  apartmentId: string
) {
  const now = new Date();
  const latestPast = await prisma.viewingAppointment.findFirst({
    where: { apartmentId, scheduledAt: { lte: now } },
    orderBy: { scheduledAt: "desc" },
  });
  await prisma.apartment.update({
    where: { id: apartmentId },
    data: { viewedAt: latestPast?.scheduledAt ?? null },
  });
}

export async function assertTestApartmentAccess(
  prisma: PrismaClient,
  apartmentId: string,
  userId: string
) {
  return prisma.apartment.findFirst({
    where: {
      id: apartmentId,
      project: { members: { some: { userId } } },
    },
    select: { id: true, projectId: true },
  });
}

export async function clearProjectData(prisma: PrismaClient) {
  await prisma.rating.deleteMany();
  await prisma.viewingAppointment.deleteMany();
  await prisma.apartmentPhoto.deleteMany();
  await prisma.apartment.deleteMany();
  await prisma.criterion.deleteMany();
  await prisma.criterionGroup.deleteMany();
  await prisma.projectMember.deleteMany();
  await prisma.project.deleteMany();
}
