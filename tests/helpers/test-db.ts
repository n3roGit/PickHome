import { execSync } from "child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { ROLE_USER } from "@/lib/auth";
import { DEFAULT_CRITERIA_GROUPS } from "@/lib/defaults";
import { resetPrismaForTests } from "@/lib/prisma";

/** One SQLite file per Vitest fork (process.pid is unique across parallel test files). */
export function getTestDbPath(): string {
  return join(process.cwd(), "data", `test-${process.pid}.db`);
}

export function getTestDatabaseUrl(): string {
  return `file:${getTestDbPath().replace(/\\/g, "/")}`;
}

export function createTestPrisma() {
  return new PrismaClient({
    datasources: { db: { url: getTestDatabaseUrl() } },
  });
}

export async function resetTestDatabase() {
  const testDbPath = getTestDbPath();
  const testDatabaseUrl = getTestDatabaseUrl();
  mkdirSync(join(process.cwd(), "data"), { recursive: true });
  await resetPrismaForTests();
  if (existsSync(testDbPath)) {
    unlinkSync(testDbPath);
  }
  execSync("npx prisma db push --skip-generate", {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: testDatabaseUrl },
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

export async function createTestPartner(
  prisma: PrismaClient,
  username = "partner",
  name = "Partner User"
) {
  return prisma.user.create({
    data: {
      username,
      name,
      passwordHash: await bcrypt.hash("testpass", 10),
      role: ROLE_USER,
    },
  });
}

export async function addTestProjectMember(
  prisma: PrismaClient,
  projectId: string,
  userId: string,
  role = "partner"
) {
  return prisma.projectMember.create({
    data: { projectId, userId, role },
  });
}

/** Fixed criteria for predictable scoring integration tests. */
export async function seedScoringTestCriteria(prisma: PrismaClient, projectId: string) {
  const group = await prisma.criterionGroup.create({
    data: { projectId, name: "Scoring test", sortOrder: 0 },
  });
  const mustHave = await prisma.criterion.create({
    data: {
      groupId: group.id,
      name: "Must have",
      weight: 5,
      isDealbreaker: true,
      sortOrder: 0,
    },
  });
  const nice = await prisma.criterion.create({
    data: {
      groupId: group.id,
      name: "Nice to have",
      weight: 3,
      isDealbreaker: false,
      sortOrder: 1,
    },
  });
  return [
    { id: mustHave.id, weight: 5, isDealbreaker: true },
    { id: nice.id, weight: 3, isDealbreaker: false },
  ] as const;
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
  await prisma.commuteCache.deleteMany();
  await prisma.rating.deleteMany();
  await prisma.viewingAppointment.deleteMany();
  await prisma.apartmentDocument.deleteMany();
  await prisma.apartmentPhoto.deleteMany();
  await prisma.apartment.deleteMany();
  await prisma.criterion.deleteMany();
  await prisma.criterionGroup.deleteMany();
  await prisma.projectMember.deleteMany();
  await prisma.project.deleteMany();
  await prisma.userAddress.deleteMany();
}

export type IsolatedDataDir = {
  dir: string;
  restore: () => void;
};

/** Temp PICKHOME_DATA_DIR for upload/backup tests; call restore() in afterEach/afterAll. */
export function withIsolatedDataDir(): IsolatedDataDir {
  const dir = mkdtempSync(join(tmpdir(), "pickhome-test-"));
  mkdirSync(dir, { recursive: true });
  const previous = process.env.PICKHOME_DATA_DIR;
  process.env.PICKHOME_DATA_DIR = dir;
  return {
    dir,
    restore() {
      if (previous === undefined) delete process.env.PICKHOME_DATA_DIR;
      else process.env.PICKHOME_DATA_DIR = previous;
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
