import { Logo } from "@/components/Logo";
import { Footer } from "@/components/Footer";
import { LoginForm } from "@/components/LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const resolvedSearchParams = await searchParams;

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
        <LoginForm initialError={resolvedSearchParams.error} />
      </main>
      <Footer />
    </>
  );
}
