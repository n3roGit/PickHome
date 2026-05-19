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

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: resolveDatabaseUrl() } },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
