import { describe, expect, it } from "vitest";
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  buildManifest,
  parseManifest,
} from "@/lib/backup";

describe("backup manifest", () => {
  it("builds and parses a valid manifest", () => {
    const manifest = buildManifest();
    expect(manifest.format).toBe(BACKUP_FORMAT);
    expect(manifest.version).toBe(BACKUP_VERSION);

    const parsed = parseManifest(JSON.stringify(manifest));
    expect(parsed.exportedAt).toBe(manifest.exportedAt);
  });

  it("rejects unknown format", () => {
    expect(() =>
      parseManifest(JSON.stringify({ format: "other", version: 1, exportedAt: "", appVersion: "" }))
    ).toThrow(/Invalid backup format/);
  });

  it("rejects unsupported version", () => {
    expect(() =>
      parseManifest(
        JSON.stringify({
          format: BACKUP_FORMAT,
          version: 99,
          exportedAt: "",
          appVersion: "",
        })
      )
    ).toThrow(/Unsupported backup version/);
  });
});
