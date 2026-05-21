import AdmZip from "adm-zip";
import { mkdir, readdir, stat, unlink } from "fs/promises";
import { join, resolve, sep } from "path";
import { getAppTimeZone } from "@/lib/app-settings";
import {
  exportBackupFileName,
  exportBackupToFile,
  importBackupFromFile,
  parseManifest,
  type BackupManifest,
} from "@/lib/backup";
import { getPickHomeDataDir } from "@/lib/pickhome-data";
import { prisma } from "@/lib/prisma";
import { scheduledRunAtInTimeZone } from "@/lib/timezone";

export const BACKUP_JOB_SETTINGS_ID = "default";
export const BACKUP_FILE_PATTERN = /^pickhome-backup-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.zip$/;

export type BackupJobSettingsView = {
  enabled: boolean;
  hour: number;
  minute: number;
  retainCount: number;
  directory: string;
  resolvedDirectory: string;
  lastRunAt: string | null;
};

export type StoredBackupFile = {
  name: string;
  sizeBytes: number;
  modifiedAt: string;
  exportedAt: string | null;
  appVersion: string | null;
};

let manualRunLock = false;

function isPathInside(parent: string, child: string): boolean {
  const normalizedParent = resolve(parent);
  const normalizedChild = resolve(child);
  return normalizedChild === normalizedParent || normalizedChild.startsWith(normalizedParent + sep);
}

export function isValidBackupFileName(name: string): boolean {
  return BACKUP_FILE_PATTERN.test(name);
}

export function resolveBackupDirectory(configured: string): string {
  const dataDir = getPickHomeDataDir();
  const trimmed = configured.trim();
  const resolved =
    trimmed === ""
      ? join(dataDir, "backups")
      : trimmed.startsWith("/") || /^[A-Za-z]:/.test(trimmed)
        ? trimmed
        : join(dataDir, trimmed);

  if (!isPathInside(dataDir, resolved)) {
    throw new Error("Backup directory must be inside the data directory");
  }

  return resolve(resolved);
}

export function resolveBackupFilePath(directory: string, fileName: string): string {
  if (!isValidBackupFileName(fileName)) {
    throw new Error("Invalid backup file name");
  }

  const filePath = join(directory, fileName);
  if (!isPathInside(directory, filePath)) {
    throw new Error("Invalid backup file path");
  }

  return filePath;
}

/** @deprecated Use scheduledRunAtInTimeZone from @/lib/timezone */
export function scheduledRunAt(date: Date, hour: number, minute: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute, 0, 0);
}

export function isBackupJobDue(
  settings: { enabled: boolean; hour: number; minute: number; lastRunAt: Date | null },
  now = new Date(),
  timeZone: string
): boolean {
  if (!settings.enabled) return false;

  const scheduled = scheduledRunAtInTimeZone(now, settings.hour, settings.minute, timeZone);
  if (now < scheduled) return false;
  if (!settings.lastRunAt) return true;
  return settings.lastRunAt < scheduled;
}

export async function getOrCreateBackupJobSettings() {
  return prisma.backupJobSettings.upsert({
    where: { id: BACKUP_JOB_SETTINGS_ID },
    create: { id: BACKUP_JOB_SETTINGS_ID },
    update: {},
  });
}

export async function getBackupJobSettingsView(): Promise<BackupJobSettingsView> {
  const settings = await getOrCreateBackupJobSettings();
  return {
    enabled: settings.enabled,
    hour: settings.hour,
    minute: settings.minute,
    retainCount: settings.retainCount,
    directory: settings.directory,
    resolvedDirectory: resolveBackupDirectory(settings.directory),
    lastRunAt: settings.lastRunAt?.toISOString() ?? null,
  };
}

export type BackupJobSettingsInput = {
  enabled: boolean;
  hour: number;
  minute: number;
  retainCount: number;
  directory: string;
};

export function validateBackupJobSettingsInput(input: BackupJobSettingsInput): string | null {
  if (!Number.isInteger(input.hour) || input.hour < 0 || input.hour > 23) {
    return "invalid_hour";
  }
  if (!Number.isInteger(input.minute) || input.minute < 0 || input.minute > 59) {
    return "invalid_minute";
  }
  if (!Number.isInteger(input.retainCount) || input.retainCount < 1 || input.retainCount > 365) {
    return "invalid_retain_count";
  }
  if (input.directory.length > 500) {
    return "invalid_directory";
  }

  try {
    resolveBackupDirectory(input.directory);
  } catch {
    return "invalid_directory";
  }

  return null;
}

export async function updateBackupJobSettings(input: BackupJobSettingsInput) {
  const error = validateBackupJobSettingsInput(input);
  if (error) {
    throw new Error(error);
  }

  return prisma.backupJobSettings.upsert({
    where: { id: BACKUP_JOB_SETTINGS_ID },
    create: {
      id: BACKUP_JOB_SETTINGS_ID,
      enabled: input.enabled,
      hour: input.hour,
      minute: input.minute,
      retainCount: input.retainCount,
      directory: input.directory.trim(),
    },
    update: {
      enabled: input.enabled,
      hour: input.hour,
      minute: input.minute,
      retainCount: input.retainCount,
      directory: input.directory.trim(),
    },
  });
}

function readBackupManifestFromZip(zipPath: string): BackupManifest | null {
  try {
    const zip = new AdmZip(zipPath);
    const entry = zip.getEntry("manifest.json");
    if (!entry) return null;
    return parseManifest(entry.getData().toString("utf-8"));
  } catch {
    return null;
  }
}

export async function listStoredBackups(directory: string): Promise<StoredBackupFile[]> {
  await mkdir(directory, { recursive: true });
  const entries = await readdir(directory, { withFileTypes: true });
  const files = entries.filter((entry) => entry.isFile() && isValidBackupFileName(entry.name));

  const items = await Promise.all(
    files.map(async (entry) => {
      const filePath = join(directory, entry.name);
      const fileStat = await stat(filePath);
      const manifest = readBackupManifestFromZip(filePath);
      return {
        name: entry.name,
        sizeBytes: fileStat.size,
        modifiedAt: fileStat.mtime.toISOString(),
        exportedAt: manifest?.exportedAt ?? null,
        appVersion: manifest?.appVersion ?? null,
      };
    })
  );

  return items.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
}

export async function pruneStoredBackups(directory: string, retainCount: number): Promise<string[]> {
  const backups = await listStoredBackups(directory);
  const removed: string[] = [];

  for (const backup of backups.slice(retainCount)) {
    await unlink(resolveBackupFilePath(directory, backup.name));
    removed.push(backup.name);
  }

  return removed;
}

export async function runBackupJob(options?: { force?: boolean }): Promise<{
  fileName: string;
  filePath: string;
  removed: string[];
}> {
  if (manualRunLock) {
    throw new Error("backup_already_running");
  }

  manualRunLock = true;
  try {
    const settings = await getOrCreateBackupJobSettings();
    if (!options?.force && !settings.enabled) {
      throw new Error("backup_job_disabled");
    }

    const directory = resolveBackupDirectory(settings.directory);
    await mkdir(directory, { recursive: true });

    const timeZone = await getAppTimeZone();
    const fileName = exportBackupFileName(timeZone);
    const filePath = join(directory, fileName);
    await exportBackupToFile(filePath);
    const removed = await pruneStoredBackups(directory, settings.retainCount);

    await prisma.backupJobSettings.update({
      where: { id: BACKUP_JOB_SETTINGS_ID },
      data: { lastRunAt: new Date() },
    });

    return { fileName, filePath, removed };
  } finally {
    manualRunLock = false;
  }
}

export async function runScheduledBackupIfDue(): Promise<boolean> {
  const [settings, timeZone] = await Promise.all([
    getOrCreateBackupJobSettings(),
    getAppTimeZone(),
  ]);
  if (!isBackupJobDue(settings, new Date(), timeZone)) return false;

  await runBackupJob();
  return true;
}

export async function deleteStoredBackup(fileName: string): Promise<void> {
  const settings = await getOrCreateBackupJobSettings();
  const directory = resolveBackupDirectory(settings.directory);
  const filePath = resolveBackupFilePath(directory, fileName);
  await unlink(filePath);
}

export async function restoreStoredBackup(
  fileName: string,
  options?: { keepPrevious?: boolean }
): Promise<void> {
  const settings = await getOrCreateBackupJobSettings();
  const directory = resolveBackupDirectory(settings.directory);
  const filePath = resolveBackupFilePath(directory, fileName);
  await importBackupFromFile(filePath, options);
}
