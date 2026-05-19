import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Logo } from "@/components/Logo";
import { TotpLoginForm } from "@/components/TotpLoginForm";
import { getPendingTotpUserId } from "@/lib/totp";
import { redirect } from "next/navigation";

export default async function TotpLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (!(await getPendingTotpUserId())) {
    redirect("/login?error=totp_expired");
  }

  const resolvedSearchParams = await searchParams;

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
        <TotpLoginForm initialError={resolvedSearchParams.error} />
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
