import Link from "next/link";
import { redirect } from "next/navigation";
import { createProjectAction } from "@/app/actions";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { getSessionUser, isAdmin } from "@/lib/auth";
import { activeProjectsListWhere } from "@/lib/project-access";
import { formatPrice } from "@/lib/scoring";
import { prisma } from "@/lib/prisma";

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const admin = isAdmin(user);

  const projects = await prisma.project.findMany({
    where: activeProjectsListWhere(user),
    include: {
      _count: { select: { apartments: { where: { archivedAt: null } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <>
      <Nav userName={user.name} isAdmin={admin} />
      <main className="max-w-6xl mx-auto px-4 py-6 sm:py-8 flex-1 min-w-0 w-full">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold">{admin ? "Alle Projekte" : "Meine Projekte"}</h1>
            <p className="text-pn-text-secondary">
              {admin
                ? "Alle Immobiliensuchen im System."
                : "Jedes Projekt ist eine Immobiliensuche."}
            </p>
          </div>
          <NewProjectForm />
        </div>
        <ul className="grid gap-4 sm:grid-cols-2">
          {projects.map((p) => (
            <li key={p.id}>
              <Link
                href={`/project/${p.id}`}
                className="block bg-pn-bg-surface border border-pn-border rounded-xl p-5 hover:border-pn-border-strong transition-colors"
              >
                <h3 className="font-semibold text-lg">{p.name}</h3>
                <p className="text-sm text-pn-text-secondary mt-1">
                  {p._count.apartments} Immobilien
                  {p.budget != null && ` · Budget: ${formatPrice(p.budget)}`}
                </p>
              </Link>
            </li>
          ))}
        </ul>
        {projects.length === 0 && (
          <p className="text-pn-text-tertiary text-center py-12">Noch keine Projekte — oben anlegen.</p>
        )}
      </main>
      <Footer />
    </>
  );
}

function NewProjectForm() {
  return (
    <form action={createProjectAction} className="flex flex-wrap gap-2 items-stretch sm:items-end w-full sm:w-auto">
      <input
        name="name"
        placeholder="Projektname"
        required
        className="border border-pn-border rounded-lg px-3 py-2 text-sm w-full min-w-0 sm:w-auto flex-1"
      />
      <input
        name="budget"
        placeholder="Budget €"
        className="border border-pn-border rounded-lg px-3 py-2 text-sm w-full sm:w-28 min-w-0"
      />
      <button type="submit" className="bg-pn-accent text-white font-semibold px-4 py-2 rounded-lg text-sm w-full sm:w-auto">
        Neues Projekt
      </button>
    </form>
  );
}
