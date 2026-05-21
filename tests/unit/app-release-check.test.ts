import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  compareSemver,
  getLatestReleaseUpdate,
  isNewerVersion,
  parseReleaseVersion,
} from "@/lib/app-release-check";

describe("app-release-check", () => {
  it("parses release tags with optional v prefix", () => {
    expect(parseReleaseVersion("v1.2.54")).toBe("1.2.54");
    expect(parseReleaseVersion("1.2.54")).toBe("1.2.54");
    expect(parseReleaseVersion("  v2.0  ")).toBe("2.0");
  });

  it("rejects invalid release tags", () => {
    expect(parseReleaseVersion("latest")).toBeNull();
    expect(parseReleaseVersion("v1.2.3-beta")).toBeNull();
  });

  it("compares semver versions", () => {
    expect(compareSemver("1.2.54", "1.2.53")).toBe(1);
    expect(compareSemver("1.2.53", "1.2.54")).toBe(-1);
    expect(compareSemver("1.2.0", "1.2")).toBe(0);
  });

  it("detects newer versions", () => {
    expect(isNewerVersion("1.2.54", "1.2.53")).toBe(true);
    expect(isNewerVersion("1.2.53", "1.2.53")).toBe(false);
    expect(isNewerVersion("1.2.52", "1.2.53")).toBe(false);
  });

  describe("getLatestReleaseUpdate", () => {
    beforeEach(() => {
      vi.unstubAllEnvs();
    });

    afterEach(() => {
      vi.unstubAllEnvs();
      vi.unstubAllGlobals();
    });

    it("returns release info when GitHub has a newer version", async () => {
      vi.stubEnv("PICKHOME_UPDATE_CHECK", "1");
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(
            JSON.stringify({
              tag_name: "v1.2.54",
              html_url: "https://github.com/n3roGit/PickHome/releases/tag/v1.2.54",
            }),
            { status: 200 }
          )
        )
      );

      await expect(getLatestReleaseUpdate("1.2.53")).resolves.toEqual({
        version: "1.2.54",
        url: "https://github.com/n3roGit/PickHome/releases/tag/v1.2.54",
      });
    });

    it("returns null when current version is up to date", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(
            JSON.stringify({
              tag_name: "v1.2.53",
              html_url: "https://github.com/n3roGit/PickHome/releases/tag/v1.2.53",
            }),
            { status: 200 }
          )
        )
      );

      await expect(getLatestReleaseUpdate("1.2.53")).resolves.toBeNull();
    });

    it("can be disabled via env", async () => {
      vi.stubEnv("PICKHOME_UPDATE_CHECK", "0");
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);

      await expect(getLatestReleaseUpdate("1.2.53")).resolves.toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
