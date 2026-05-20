import { PrismaClient } from "@prisma/client";
import { join } from "path";

/** SQLite paths in DATABASE_URL are relative to prisma/ — resolve to an absolute path. */
export function resolveDatabaseUrl(url = process.env.DATABASE_URL): string {
  const rawUrl =
    url ??
    (process.env.NODE_ENV === "production" ? "file:/app/data/pickhome.db" : undefined);
  if (!rawUrl) {
    throw new Error("DATABASE_URL is not set");
  }
  if (!rawUrl.startsWith("file:")) return rawUrl;
  const pathPart = rawUrl.slice("file:".length);
  if (pathPart.startsWith("/") || /^[A-Za-z]:/.test(pathPart)) return rawUrl;
  const absolute = join(process.cwd(), "prisma", pathPart).replace(/\\/g, "/");
  return `file:${absolute}`;
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: resolveDatabaseUrl() } },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export function getPrismaClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}

/** Lazily reconnects after `resetPrismaForTests()` (used in integration tests). */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrismaClient();
    const value = Reflect.get(client, prop, client) as unknown;
    return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(client) : value;
  },
});

/** Disconnect and drop the singleton so the next access opens a fresh DB (tests only). */
export async function resetPrismaForTests(): Promise<void> {
  if (globalForPrisma.prisma) {
    await globalForPrisma.prisma.$disconnect();
    globalForPrisma.prisma = undefined;
  }
}
