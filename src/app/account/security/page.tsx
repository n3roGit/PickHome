import Link from "next/link";
import {
  beginTotpSetupAction,
  cancelTotpSetupAction,
  confirmTotpSetupAction,
  disableTotpAction,
  getTotpQrDataUrl,
  regenerateRecoveryCodesAction,
} from "@/app/totp-actions";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import { isAdmin, requireUser } from "@/lib/auth";
import { isTotpEnabled } from "@/lib/totp";
import { prisma } from "@/lib/prisma";

const errors: Record<string, string> = {
  already_enabled: "Zwei-Faktor-Authentifizierung ist bereits aktiv.",
  invalid_code: "Der Code ist ungültig. Bitte erneut versuchen.",
  bad_password: "Passwort ist falsch.",
  bad_code: "Authenticator-Code ist ungültig.",
};

export default async function SecurityPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    step?: string;
    codes?: string;
    disabled?: string;
  }>;
}) {
  const resolvedSearchParams = await searchParams;
  const user = await requireUser();
  const fresh = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  const enabled = isTotpEnabled(fresh);
  const pendingSetup = !!fresh.totpSecret && !enabled;
  const err = resolvedSearchParams.error ? errors[resolvedSearchParams.error] : null;
  const showConfirm = resolvedSearchParams.step === "confirm" && pendingSetup;
  const recoveryCodes =
    resolvedSearchParams.step === "recovery" && resolvedSearchParams.codes
      ? resolvedSearchParams.codes.split(",").filter(Boolean)
      : null;
  const unusedRecoveryCount = enabled
    ? await prisma.userRecoveryCode.count({
        where: { userId: user.id, usedAt: null },
      })
    : 0;

  const qrDataUrl =
    showConfirm && fresh.totpSecret
      ? await getTotpQrDataUrl({ username: fresh.username, totpSecret: fresh.totpSecret })
      : null;

  return (
    <>
      <Nav userName={user.name} isAdmin={isAdmin(user)} />
      <main className="max-w-lg mx-auto px-4 py-8 flex-1 w-full">
        <Link
          href={isAdmin(user) ? "/admin" : "/dashboard"}
          className="text-sm text-pn-accent hover:underline"
        >
          ← Zurück
        </Link>
        <h1 className="text-2xl font-bold mt-4 mb-2">Sicherheit</h1>
        <p className="text-sm text-pn-text-secondary mb-6">
          Zwei-Faktor-Authentifizierung (TOTP) mit Authenticator-App und Wiederherstellungscodes.
        </p>

        {resolvedSearchParams.disabled === "1" && (
          <p className="mb-4 text-sm text-pn-score-high bg-pn-score-high-bg px-3 py-2 rounded-lg">
            Zwei-Faktor-Authentifizierung wurde deaktiviert.
          </p>
        )}
        {err && (
          <p className="mb-4 text-sm text-pn-score-low bg-pn-score-low-bg px-3 py-2 rounded-lg">{err}</p>
        )}

        {recoveryCodes && recoveryCodes.length > 0 && (
          <section className="mb-6 bg-pn-score-high-bg border border-pn-border rounded-xl p-4">
            <h2 className="font-semibold mb-2">Wiederherstellungscodes</h2>
            <p className="text-sm text-pn-text-secondary mb-3">
              Einmalig anzeigen — sicher aufbewahren. Jeder Code kann nur einmal verwendet werden.
            </p>
            <ul className="font-mono text-sm space-y-1 bg-pn-bg-surface rounded-lg p-3 border border-pn-border">
              {recoveryCodes.map((code) => (
                <li key={code}>{code}</li>
              ))}
            </ul>
          </section>
        )}

        {!enabled && !showConfirm && (
          <section className="bg-pn-bg-surface border border-pn-border rounded-xl p-5 mb-6">
            <h2 className="font-semibold mb-2">2FA aktivieren</h2>
            <p className="text-sm text-pn-text-secondary mb-4">
              Schütze dein Konto mit Google Authenticator, Authy oder einer anderen TOTP-App.
            </p>
            <form action={beginTotpSetupAction}>
              <button
                type="submit"
                className="bg-pn-accent text-white font-semibold px-4 py-2 rounded-lg text-sm"
              >
                Einrichtung starten
              </button>
            </form>
          </section>
        )}

        {showConfirm && qrDataUrl && (
          <section className="bg-pn-bg-surface border border-pn-border rounded-xl p-5 mb-6 space-y-4">
            <h2 className="font-semibold">Authenticator verknüpfen</h2>
            <p className="text-sm text-pn-text-secondary">
              QR-Code scannen oder Secret manuell eintragen:{" "}
              <code className="text-xs break-all">{fresh.totpSecret}</code>
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrDataUrl} alt="TOTP QR code" className="mx-auto w-48 h-48" />
            <form action={confirmTotpSetupAction} className="space-y-3">
              <label className="block">
                <span className="text-sm font-medium text-pn-text-secondary">
                  Bestätigungscode aus der App
                </span>
                <input
                  name="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  className="mt-1 w-full border border-pn-border rounded-lg px-3 py-2 font-mono"
                />
              </label>
              <button
                type="submit"
                className="w-full bg-pn-accent text-white font-semibold py-2 rounded-lg text-sm"
              >
                Aktivieren
              </button>
            </form>
            <form action={cancelTotpSetupAction}>
              <button type="submit" className="text-sm text-pn-text-secondary hover:underline">
                Abbrechen
              </button>
            </form>
          </section>
        )}

        {enabled && (
          <>
            <section className="bg-pn-bg-surface border border-pn-border rounded-xl p-5 mb-6">
              <h2 className="font-semibold mb-2">Status</h2>
              <p className="text-sm text-pn-score-high font-medium mb-1">2FA ist aktiv</p>
              <p className="text-sm text-pn-text-tertiary">
                {unusedRecoveryCount} unbenutzte Wiederherstellungscode(s)
              </p>
            </section>

            <section className="bg-pn-bg-surface border border-pn-border rounded-xl p-5 mb-6">
              <h2 className="font-semibold mb-2">Neue Wiederherstellungscodes</h2>
              <p className="text-sm text-pn-text-secondary mb-3">
                Ersetzt alle bisherigen Codes. Passwort und aktueller TOTP-Code erforderlich.
              </p>
              <form action={regenerateRecoveryCodesAction} className="space-y-3">
                <input
                  name="password"
                  type="password"
                  required
                  placeholder="Passwort"
                  className="w-full border border-pn-border rounded-lg px-3 py-2 text-sm"
                />
                <input
                  name="code"
                  required
                  placeholder="6-stelliger Code"
                  className="w-full border border-pn-border rounded-lg px-3 py-2 text-sm font-mono"
                />
                <button
                  type="submit"
                  className="bg-pn-bg-subtle border border-pn-border font-medium px-4 py-2 rounded-lg text-sm"
                >
                  Codes neu erzeugen
                </button>
              </form>
            </section>

            <section className="bg-pn-bg-surface border border-pn-border rounded-xl p-5">
              <h2 className="font-semibold mb-2 text-pn-score-low">2FA deaktivieren</h2>
              <form action={disableTotpAction} className="space-y-3">
                <input
                  name="password"
                  type="password"
                  required
                  placeholder="Passwort"
                  className="w-full border border-pn-border rounded-lg px-3 py-2 text-sm"
                />
                <input
                  name="code"
                  required
                  placeholder="6-stelliger Code"
                  className="w-full border border-pn-border rounded-lg px-3 py-2 text-sm font-mono"
                />
                <button
                  type="submit"
                  className="text-sm text-pn-score-low font-medium hover:underline"
                >
                  Zwei-Faktor-Authentifizierung abschalten
                </button>
              </form>
            </section>
          </>
        )}
      </main>
      <Footer />
    </>
  );
}
