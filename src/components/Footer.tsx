import { APP_VERSION } from "@/lib/app-version";

export function Footer() {
  return (
    <footer className="border-t border-pn-border mt-auto py-4 text-center text-sm text-pn-text-tertiary">
      <p>PickHome — Immobilien bewerten und vergleichen</p>
      <p className="text-xs mt-1">Version {APP_VERSION}</p>
    </footer>
  );
}
