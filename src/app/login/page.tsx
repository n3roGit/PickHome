import { loginAction } from "@/app/totp-actions";
import { Logo } from "@/components/Logo";
import { Footer } from "@/components/Footer";

const errors: Record<string, string> = {
  invalid: "Benutzername oder Passwort falsch.",
  totp_expired: "Zwei-Faktor-Anmeldung abgelaufen. Bitte erneut anmelden.",
};

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const err = searchParams.error ? errors[searchParams.error] : null;

  return (
    <>
      <header className="bg-pn-bg-surface border-b border-pn-border py-4">
        <div className="max-w-md mx-auto px-4 flex justify-center">
          <Logo className="h-14 w-auto" />
        </div>
      </header>
      <main className="max-w-md mx-auto px-4 py-12 flex-1 w-full">
        <h1 className="text-2xl font-bold mb-2">Anmelden</h1>
        <p className="text-pn-text-secondary text-sm mb-6">PickHome — lokale Immobilienbewertung</p>
        {err && (
          <p className="mb-4 text-sm text-pn-score-low bg-pn-score-low-bg px-3 py-2 rounded-lg">{err}</p>
        )}
        <form action={loginAction} className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-pn-text-secondary">Benutzername</span>
            <input
              name="username"
              autoComplete="username"
              required
              className="mt-1 w-full border border-pn-border rounded-lg px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-pn-text-secondary">Passwort</span>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="mt-1 w-full border border-pn-border rounded-lg px-3 py-2"
            />
          </label>
          <button type="submit" className="w-full bg-pn-accent text-white font-semibold py-2.5 rounded-lg">
            Anmelden
          </button>
        </form>
      </main>
      <Footer />
    </>
  );
}
