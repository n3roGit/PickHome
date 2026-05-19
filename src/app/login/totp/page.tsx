import Link from "next/link";
import { cancelTotpLoginAction, verifyTotpLoginAction } from "@/app/totp-actions";
import { Footer } from "@/components/Footer";
import { Logo } from "@/components/Logo";
import { getPendingTotpUserId } from "@/lib/totp";
import { redirect } from "next/navigation";

const errors: Record<string, string> = {
  invalid: "Code ungültig. Authenticator-App oder Wiederherstellungscode prüfen.",
};

export default function TotpLoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  if (!getPendingTotpUserId()) {
    redirect("/login?error=totp_expired");
  }

  const err = searchParams.error ? errors[searchParams.error] : null;

  return (
    <>
      <header className="bg-pn-bg-surface border-b border-pn-border py-4">
        <div className="max-w-md mx-auto px-4 flex justify-center">
          <Logo className="h-14 w-auto" />
        </div>
      </header>
      <main className="max-w-md mx-auto px-4 py-12 flex-1 w-full">
        <h1 className="text-2xl font-bold mb-2">Zwei-Faktor-Authentifizierung</h1>
        <p className="text-pn-text-secondary text-sm mb-6">
          Gib den 6-stelligen Code aus deiner Authenticator-App ein oder einen Wiederherstellungscode.
        </p>
        {err && (
          <p className="mb-4 text-sm text-pn-score-low bg-pn-score-low-bg px-3 py-2 rounded-lg">{err}</p>
        )}
        <form action={verifyTotpLoginAction} className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-pn-text-secondary">Code</span>
            <input
              name="code"
              autoComplete="one-time-code"
              inputMode="text"
              required
              placeholder="123456 oder xxxx-xxxx-xxxx"
              className="mt-1 w-full border border-pn-border rounded-lg px-3 py-2 font-mono"
            />
          </label>
          <button type="submit" className="w-full bg-pn-accent text-white font-semibold py-2.5 rounded-lg">
            Bestätigen
          </button>
        </form>
        <form action={cancelTotpLoginAction} className="mt-4">
          <button type="submit" className="text-sm text-pn-text-secondary hover:underline">
            Abbrechen
          </button>
        </form>
        <p className="mt-6 text-xs text-pn-text-tertiary">
          <Link href="/login" className="text-pn-accent hover:underline">
            Zurück zur Anmeldung
          </Link>
        </p>
      </main>
      <Footer />
    </>
  );
}
