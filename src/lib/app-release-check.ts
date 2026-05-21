import { APP_VERSION } from "@/lib/app-version";

const GITHUB_RELEASES_LATEST_URL =
  "https://api.github.com/repos/n3roGit/PickHome/releases/latest";
const UPDATE_CHECK_REVALIDATE_SEC = 6 * 60 * 60;

type GitHubLatestRelease = {
  tag_name?: unknown;
  html_url?: unknown;
};

export function parseReleaseVersion(tagName: string): string | null {
  const trimmed = tagName.trim();
  const normalized = trimmed.startsWith("v") ? trimmed.slice(1) : trimmed;
  if (!/^\d+(?:\.\d+){0,2}$/.test(normalized)) return null;
  return normalized;
}

export function compareSemver(left: string, right: string): -1 | 0 | 1 {
  const leftParts = left.split(".").map((part) => Number.parseInt(part, 10));
  const rightParts = right.split(".").map((part) => Number.parseInt(part, 10));
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const leftValue = leftParts[index] ?? 0;
    const rightValue = rightParts[index] ?? 0;
    if (leftValue > rightValue) return 1;
    if (leftValue < rightValue) return -1;
  }

  return 0;
}

export function isNewerVersion(latest: string, current: string): boolean {
  return compareSemver(latest, current) > 0;
}

function updateCheckEnabled(): boolean {
  return process.env.PICKHOME_UPDATE_CHECK !== "0";
}

export type LatestReleaseUpdate = {
  version: string;
  url: string;
};

export async function getLatestReleaseUpdate(
  currentVersion: string = APP_VERSION
): Promise<LatestReleaseUpdate | null> {
  if (!updateCheckEnabled()) return null;

  try {
    const response = await fetch(GITHUB_RELEASES_LATEST_URL, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": `PickHome/${currentVersion}`,
      },
      next: { revalidate: UPDATE_CHECK_REVALIDATE_SEC },
    });
    if (!response.ok) return null;

    const data = (await response.json()) as GitHubLatestRelease;
    if (typeof data.tag_name !== "string" || typeof data.html_url !== "string") {
      return null;
    }

    const latestVersion = parseReleaseVersion(data.tag_name);
    if (!latestVersion || !isNewerVersion(latestVersion, currentVersion)) {
      return null;
    }

    return { version: latestVersion, url: data.html_url };
  } catch {
    return null;
  }
}
