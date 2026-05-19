import { createUserAction, deleteUserAction, resetUserPasswordAction } from "@/app/actions";
import { AdminBackupPanel } from "@/components/AdminBackupPanel";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { requireAdmin, isAdmin } from "@/lib/auth";
import { MIN_PASSWORD_LENGTH } from "@/lib/password";
import { prisma } from "@/lib/prisma";

const messages: Record<string, string> = {
  fields: "Bitte alle Felder ausfüllen.",
  exists: "Benutzername existiert bereits.",
  password_too_short: `Passwort zu kurz (min. ${MIN_PASSWORD_LENGTH} Zeichen).`,
  password_mismatch: "Die Passwörter stimmen nicht überein.",
  lastadmin: "Der letzte Administrator kann nicht gelöscht werden.",
};

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string; password_reset?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const admin = await requireAdmin();
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      createdAt: true,
      _count: { select: { projects: true, ratings: true } },
    },
  });

  const msg = resolvedSearchParams.error ? messages[resolvedSearchParams.error] : null;
  const created = resolvedSearchParams.created === "1";
  const passwordResetUser = resolvedSearchParams.password_reset;

  return (
    <>
      <Nav userName={admin.name} isAdmin />
      <main className="max-w-4xl mx-auto px-4 py-8 flex-1 w-full">
        <h1 className="text-2xl font-bold mb-2">Benutzerverwaltung</h1>
        <p className="text-pn-text-secondary text-sm mb-8">
          Benutzer anlegen — diese können sich mit Benutzername und Passwort anmelden und Projekte erstellen.
        </p>

        {msg && (
          <p className="mb-4 text-sm text-pn-score-low bg-pn-score-low-bg px-3 py-2 rounded-lg">{msg}</p>
        )}
        {created && (
          <p className="mb-4 text-sm text-pn-score-high bg-pn-score-high-bg px-3 py-2 rounded-lg">
            Benutzer wurde angelegt.
          </p>
        )}
        {passwordResetUser && (
          <p className="mb-4 text-sm text-pn-score-high bg-pn-score-high-bg px-3 py-2 rounded-lg">
            Passwort für <span className="font-mono">{passwordResetUser}</span> wurde gesetzt.
          </p>
        )}

        <AdminBackupPanel />

        <section className="bg-pn-bg-surface border border-pn-border rounded-xl p-5 mb-8">
          <h2 className="font-semibold mb-4">Neuer Benutzer</h2>
          <form action={createUserAction} className="grid sm:grid-cols-2 gap-3">
            <input
              name="username"
              placeholder="Benutzername"
              required
              pattern="[a-zA-Z0-9._-]+"
              title="Nur Buchstaben, Zahlen, Punkt, Unterstrich, Bindestrich"
              className="border border-pn-border rounded-lg px-3 py-2 text-sm"
            />
            <input
              name="name"
              placeholder="Anzeigename"
              required
              className="border border-pn-border rounded-lg px-3 py-2 text-sm"
            />
            <input
              name="password"
              type="password"
              placeholder="Passwort"
              required
              minLength={MIN_PASSWORD_LENGTH}
              className="border border-pn-border rounded-lg px-3 py-2 text-sm"
            />
            <input
              name="passwordConfirm"
              type="password"
              placeholder="Passwort bestätigen"
              required
              minLength={MIN_PASSWORD_LENGTH}
              className="border border-pn-border rounded-lg px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="sm:col-span-2 bg-pn-accent text-white font-semibold py-2 rounded-lg text-sm"
            >
              Benutzer anlegen
            </button>
          </form>
        </section>

        <section>
          <h2 className="font-semibold mb-4">Benutzer ({users.length})</h2>
          <div className="overflow-x-auto border border-pn-border rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-pn-bg-subtle text-left">
                <tr>
                  <th className="p-3">Benutzername</th>
                  <th className="p-3">Name</th>
                  <th className="p-3">Rolle</th>
                  <th className="p-3">Projekte</th>
                  <th className="p-3">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t border-pn-border">
                    <td className="p-3 font-mono">{u.username}</td>
                    <td className="p-3">{u.name}</td>
                    <td className="p-3">{isAdmin(u) ? "Admin" : "Benutzer"}</td>
                    <td className="p-3">{u._count.projects}</td>
                    <td className="p-3">
                      {!isAdmin(u) && (
                        <form action={deleteUserAction.bind(null, u.id)} className="inline">
                          <button
                            type="submit"
                            className="text-pn-score-low text-xs hover:underline mr-3"
                          >
                            Löschen
                          </button>
                        </form>
                      )}
                      <details className="inline">
                        <summary className="text-pn-accent text-xs cursor-pointer hover:underline">
                          Passwort
                        </summary>
                        <form
                          action={resetUserPasswordAction.bind(null, u.id)}
                          className="mt-2 flex flex-col gap-2 min-w-[12rem]"
                        >
                          <input
                            name="password"
                            type="password"
                            placeholder="Neues Passwort"
                            minLength={MIN_PASSWORD_LENGTH}
                            required
                            className="border border-pn-border rounded px-2 py-1 text-xs"
                          />
                          <input
                            name="passwordConfirm"
                            type="password"
                            placeholder="Passwort bestätigen"
                            minLength={MIN_PASSWORD_LENGTH}
                            required
                            className="border border-pn-border rounded px-2 py-1 text-xs"
                          />
                          <button type="submit" className="text-xs bg-pn-bg-subtle px-2 py-1 rounded border self-start">
                            Setzen
                          </button>
                        </form>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
