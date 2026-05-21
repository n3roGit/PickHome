import { describe, expect, it } from "vitest";
import {
  BACKUP_FILE_PATTERN,
  isBackupJobDue,
  isValidBackupFileName,
  resolveBackupDirectory,
  validateBackupJobSettingsInput,
} from "@/lib/backup-jobs";
import { scheduledRunAtInTimeZone } from "@/lib/timezone";

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
  const timeZone = "UTC";

  it("is due after scheduled time when never run", () => {
    const now = new Date("2026-05-20T05:00:00Z");
    expect(
      isBackupJobDue({ enabled: true, hour: 4, minute: 0, lastRunAt: null }, now, timeZone)
    ).toBe(true);
  });

  it("is not due before scheduled time", () => {
    const now = new Date("2026-05-20T03:30:00Z");
    expect(
      isBackupJobDue({ enabled: true, hour: 4, minute: 0, lastRunAt: null }, now, timeZone)
    ).toBe(false);
  });

  it("is not due again after successful run today", () => {
    const scheduled = scheduledRunAtInTimeZone(
      new Date("2026-05-20T05:00:00Z"),
      4,
      0,
      timeZone
    );
    const now = new Date("2026-05-20T06:00:00Z");
    expect(
      isBackupJobDue(
        { enabled: true, hour: 4, minute: 0, lastRunAt: scheduled },
        now,
        timeZone
      )
    ).toBe(false);
  });

  it("is due again on the next day", () => {
    const lastRun = scheduledRunAtInTimeZone(
      new Date("2026-05-19T04:00:00Z"),
      4,
      0,
      timeZone
    );
    const now = new Date("2026-05-20T04:05:00Z");
    expect(
      isBackupJobDue({ enabled: true, hour: 4, minute: 0, lastRunAt: lastRun }, now, timeZone)
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
