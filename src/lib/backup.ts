import AdmZip from "adm-zip";
import { access, copyFile, cp, mkdir, readFile, rm, unlink } from "fs/promises";
import { join } from "path";
import { getPickHomeDataDir, getUploadsRoot } from "@/lib/pickhome-data";
import { resolveDatabaseUrl } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";

export const BACKUP_FORMAT = "pickhome-backup";
export const BACKUP_VERSION = 1;

export type BackupManifest = {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  appVersion: string;
};

export function getDatabaseFilePath(): string {
  const url = resolveDatabaseUrl();
  if (!url.startsWith("file:")) {
    throw new Error("Backup only supports file-based SQLite databases");
  }
  return url.replace(/^file:/, "");
}

async function pathExists(path: string) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function checkpointDatabase() {
  await prisma.$queryRawUnsafe("PRAGMA wal_checkpoint(TRUNCATE)");
}

export function buildManifest(): BackupManifest {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    appVersion: process.env.npm_package_version ?? "1.0.0",
  };
}

export function parseManifest(raw: string): BackupManifest {
  const data = JSON.parse(raw) as BackupManifest;
  if (data.format !== BACKUP_FORMAT) {
    throw new Error("Invalid backup format");
  }
  if (data.version !== BACKUP_VERSION) {
    throw new Error(`Unsupported backup version: ${data.version}`);
  }
  return data;
}

export async function exportBackupToFile(targetPath: string) {
  await checkpointDatabase();

  const dbPath = getDatabaseFilePath();
  if (!(await pathExists(dbPath))) {
    throw new Error("Database file not found");
  }

  const uploadsRoot = getUploadsRoot();
  const manifest = buildManifest();

  await mkdir(join(getPickHomeDataDir(), "backups"), { recursive: true });

  const zip = new AdmZip();
  zip.addFile("manifest.json", Buffer.from(JSON.stringify(manifest, null, 2), "utf-8"));
  zip.addLocalFile(dbPath, "", "pickhome.db");
  if (await pathExists(uploadsRoot)) {
    zip.addLocalFolder(uploadsRoot, "uploads");
  }
  zip.writeZip(targetPath);
}

export function exportBackupFileName() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `pickhome-backup-${stamp}.zip`;
}

export async function exportBackupToBuffer(): Promise<Buffer> {
  const dataDir = getPickHomeDataDir();
  await mkdir(join(dataDir, "backups"), { recursive: true });
  const tempPath = join(dataDir, "backups", `.export-${Date.now()}.zip`);
  try {
    await exportBackupToFile(tempPath);
    return await readFile(tempPath);
  } finally {
    await unlink(tempPath).catch(() => undefined);
  }
}

export async function importBackupFromFile(
  zipPath: string,
  options?: { keepPrevious?: boolean }
) {
  const dataDir = getPickHomeDataDir();
  const stagingDir = join(dataDir, ".import-staging");
  const dbPath = getDatabaseFilePath();
  const uploadsRoot = getUploadsRoot();

  await rm(stagingDir, { recursive: true, force: true });
  const zip = new AdmZip(zipPath);
  zip.extractAllTo(stagingDir, true);

  const manifestPath = join(stagingDir, "manifest.json");
  const stagedDb = join(stagingDir, "pickhome.db");
  const stagedUploads = join(stagingDir, "uploads");

  if (!(await pathExists(manifestPath)) || !(await pathExists(stagedDb))) {
    await rm(stagingDir, { recursive: true, force: true });
    throw new Error("Backup archive is missing manifest.json or pickhome.db");
  }

  parseManifest(await readFile(manifestPath, "utf-8"));

  await checkpointDatabase();
  await prisma.$disconnect();

  if (options?.keepPrevious) {
    const stamp = Date.now();
    if (await pathExists(dbPath)) {
      await copyFile(dbPath, `${dbPath}.pre-import-${stamp}`);
    }
    if (await pathExists(uploadsRoot)) {
      await cp(uploadsRoot, `${uploadsRoot}.pre-import-${stamp}`, { recursive: true });
    }
  }

  await copyFile(stagedDb, dbPath);
  await rm(uploadsRoot, { recursive: true, force: true });
  if (await pathExists(stagedUploads)) {
    await mkdir(join(uploadsRoot, ".."), { recursive: true });
    await cp(stagedUploads, uploadsRoot, { recursive: true });
  } else {
    await mkdir(join(uploadsRoot, "apartments"), { recursive: true });
  }

  await rm(stagingDir, { recursive: true, force: true });
}

export async function importBackupFromBuffer(buffer: Buffer, options?: { keepPrevious?: boolean }) {
  const tempPath = join(getPickHomeDataDir(), "backups", `.import-${Date.now()}.zip`);
  await mkdir(join(getPickHomeDataDir(), "backups"), { recursive: true });
  const { writeFile } = await import("fs/promises");
  await writeFile(tempPath, buffer);
  try {
    await importBackupFromFile(tempPath, options);
  } finally {
    await unlink(tempPath).catch(() => undefined);
  }
}
