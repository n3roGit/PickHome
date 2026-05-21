import { APP_VERSION } from "@/lib/app-version";
import { getLatestReleaseUpdate } from "@/lib/app-release-check";

export async function Footer() {
  const releaseUpdate = await getLatestReleaseUpdate();

  return (
    <footer className="border-t border-pn-border mt-auto py-4 text-center text-sm text-pn-text-tertiary">
      <p>PickHome — Immobilien bewerten und vergleichen</p>
      <p className="text-xs mt-1">Version {APP_VERSION}</p>
      {releaseUpdate ? (
        <p className="text-xs mt-1">
          <a
            href={releaseUpdate.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-pn-accent hover:underline"
          >
            Neue Version {releaseUpdate.version} verfügbar
          </a>
        </p>
      ) : null}
    </footer>
  );
}
