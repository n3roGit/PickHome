import { describe, expect, it } from "vitest";
import {
  BACKUP_FILE_PATTERN,
  isBackupJobDue,
  isValidBackupFileName,
  resolveBackupDirectory,
  scheduledRunAt,
  validateBackupJobSettingsInput,
} from "@/lib/backup-jobs";

describe("backup job settings validation", () => {
  it("accepts valid settings", () => {
    expect(
      validateBackupJobSettingsInput({
        enabled: true,
        hour: 4,
        minute: 0,
        retainCount: 7,
        directory: "backups",
      })
    ).toBeNull();
  });

  it("rejects invalid retain count", () => {
    expect(
      validateBackupJobSettingsInput({
        enabled: true,
        hour: 4,
        minute: 0,
        retainCount: 0,
        directory: "",
      })
    ).toBe("invalid_retain_count");
  });
});

describe("backup directory resolution", () => {
  it("uses default backups directory when empty", () => {
    const resolved = resolveBackupDirectory("");
    expect(resolved.endsWith("backups")).toBe(true);
  });

  it("rejects paths outside data directory", () => {
    expect(() => resolveBackupDirectory("../etc")).toThrow(/inside the data directory/);
  });
});

describe("backup job schedule", () => {
  it("is due after scheduled time when never run", () => {
    const now = new Date(2026, 4, 20, 5, 0, 0);
    expect(
      isBackupJobDue({ enabled: true, hour: 4, minute: 0, lastRunAt: null }, now)
    ).toBe(true);
  });

  it("is not due before scheduled time", () => {
    const now = new Date(2026, 4, 20, 3, 30, 0);
    expect(
      isBackupJobDue({ enabled: true, hour: 4, minute: 0, lastRunAt: null }, now)
    ).toBe(false);
  });

  it("is not due again after successful run today", () => {
    const scheduled = scheduledRunAt(new Date(2026, 4, 20, 5, 0, 0), 4, 0);
    const now = new Date(2026, 4, 20, 6, 0, 0);
    expect(
      isBackupJobDue(
        { enabled: true, hour: 4, minute: 0, lastRunAt: scheduled },
        now
      )
    ).toBe(false);
  });

  it("is due again on the next day", () => {
    const lastRun = scheduledRunAt(new Date(2026, 4, 19, 4, 0, 0), 4, 0);
    const now = new Date(2026, 4, 20, 4, 5, 0);
    expect(
      isBackupJobDue({ enabled: true, hour: 4, minute: 0, lastRunAt: lastRun }, now)
    ).toBe(true);
  });
});

describe("backup file names", () => {
  it("matches exported backup filenames", () => {
    expect(isValidBackupFileName("pickhome-backup-2026-05-20T04-00-00.zip")).toBe(true);
    expect(BACKUP_FILE_PATTERN.test("pickhome-backup-2026-05-20T04-00-00.zip")).toBe(true);
  });

  it("rejects unsafe names", () => {
    expect(isValidBackupFileName("../pickhome-backup-evil.zip")).toBe(false);
    expect(isValidBackupFileName("manifest.json")).toBe(false);
  });
});
