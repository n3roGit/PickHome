import Link from "next/link";
import { redirect } from "next/navigation";
import { createProjectAction } from "@/app/actions";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { getSessionUser, isAdmin } from "@/lib/auth";
import { formatPrice } from "@/lib/scoring";
import { prisma } from "@/lib/prisma";

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (isAdmin(user)) redirect("/admin");

  const projects = await prisma.project.findMany({
    where: { members: { some: { userId: user.id } }, archivedAt: null },
    include: {
      _count: { select: { apartments: { where: { archivedAt: null } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <>
      <Nav userName={user.name} />
      <main className="max-w-6xl mx-auto px-4 py-8 flex-1">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold">Meine Projekte</h1>
            <p className="text-pn-text-secondary">Jedes Projekt ist eine Immobiliensuche.</p>
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
    <form action={createProjectAction} className="flex flex-wrap gap-2 items-end">
      <input
        name="name"
        placeholder="Projektname"
        required
        className="border border-pn-border rounded-lg px-3 py-2 text-sm"
      />
      <input
        name="budget"
        placeholder="Budget €"
        className="border border-pn-border rounded-lg px-3 py-2 text-sm w-28"
      />
      <button type="submit" className="bg-pn-accent text-white font-semibold px-4 py-2 rounded-lg text-sm">
        Neues Projekt
      </button>
    </form>
  );
}
