import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { formatDateDe } from "@/lib/dates";
import { nextViewing } from "@/lib/viewings";
import { addProjectMemberAction, createApartmentAction } from "@/app/actions";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { ScoreBadge } from "@/components/ScoreBadge";
import { CriteriaEditor } from "@/components/CriteriaEditor";
import { DeleteProjectButton } from "@/components/DeleteProjectButton";
import { CompareView } from "@/components/CompareView";
import { ProjectMap } from "@/components/ProjectMap";
import { ProjectCalendar } from "@/components/ProjectCalendar";
import { getSessionUser, isAdmin } from "@/lib/auth";
import {
  apartmentScore,
  flattenCriteria,
  getProjectForUser,
} from "@/lib/project-data";
import { prisma } from "@/lib/prisma";
import { ensureProjectIcalToken } from "@/lib/ical-token";
import { formatPrice, pricePerPoint } from "@/lib/scoring";

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { tab?: string };
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (isAdmin(user)) redirect("/admin");

  const tab = searchParams.tab ?? "apartments";
  const isArchivedTab = tab === "archived";

  const project = await getProjectForUser(params.id, user.id, { archived: isArchivedTab });
  if (!project) redirect("/dashboard");

  const needsActiveList = tab === "compare" || tab === "map" || tab === "calendar";
  const activeProject = needsActiveList
    ? await getProjectForUser(params.id, user.id, { archived: false })
    : null;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const icalToken =
    tab === "calendar" && activeProject ? await ensureProjectIcalToken(params.id) : null;
  const icalUrl = icalToken
    ? `${baseUrl}/api/projects/${params.id}/calendar.ics?token=${icalToken}`
    : "";

  const criteriaWithGroup = (activeProject ?? project).groups.flatMap((g) =>
    g.criteria.map((c) => ({
      id: c.id,
      name: c.name,
      weight: c.weight,
      isDealbreaker: c.isDealbreaker,
      groupName: g.name,
    }))
  );

  const calendarEvents =
    activeProject?.apartments.flatMap((a) =>
      a.viewings.map((v) => ({
        id: v.id,
        apartmentId: a.id,
        apartmentTitle: a.title,
        scheduledAt: v.scheduledAt.toISOString(),
        note: v.note,
      }))
    ) ?? [];

  const memberFilter = { project: { members: { some: { userId: user.id } } } };
  const [activeCount, archivedCount] = await Promise.all([
    prisma.apartment.count({ where: { projectId: params.id, archivedAt: null, ...memberFilter } }),
    prisma.apartment.count({
      where: { projectId: params.id, archivedAt: { not: null }, ...memberFilter },
    }),
  ]);

  const criteria = flattenCriteria(project.groups);

  const apartments = project.apartments.map((a) => {
    const result = apartmentScore(criteria, a.ratings, user.id);
    return { ...a, ...result };
  });

  apartments.sort((a, b) => b.score - a.score);

  return (
    <>
      <Nav userName={user.name} />
      <main className="max-w-6xl mx-auto px-4 py-8 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <h1 className="text-2xl font-bold">{project.name}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <form action={addProjectMemberAction.bind(null, project.id)} className="flex gap-2 items-center">
              <input
                name="username"
                placeholder="Partner (Benutzername)"
                className="border border-pn-border rounded-lg px-3 py-1.5 text-sm"
              />
              <button type="submit" className="text-sm border border-pn-border px-3 py-1.5 rounded-lg hover:bg-pn-bg-subtle">
                Einladen
              </button>
            </form>
            <DeleteProjectButton projectId={project.id} projectName={project.name} />
          </div>
        </div>

        <div className="flex gap-2 border-b border-pn-border mb-6">
          <TabLink href={`/project/${project.id}`} active={tab === "apartments"}>
            Immobilien ({activeCount})
          </TabLink>
          <TabLink href={`/project/${project.id}?tab=archived`} active={tab === "archived"}>
            Archiv ({archivedCount})
          </TabLink>
          <TabLink href={`/project/${project.id}?tab=criteria`} active={tab === "criteria"}>
            Kriterien ({criteria.length})
          </TabLink>
          <TabLink href={`/project/${project.id}?tab=compare`} active={tab === "compare"}>
            Vergleich
          </TabLink>
          <TabLink href={`/project/${project.id}?tab=map`} active={tab === "map"}>
            Karte
          </TabLink>
          <TabLink href={`/project/${project.id}?tab=calendar`} active={tab === "calendar"}>
            Kalender
          </TabLink>
        </div>

        {(tab === "apartments" || tab === "archived") && (
          <>
            {tab === "apartments" && (
            <form action={createApartmentAction.bind(null, project.id)} className="flex flex-wrap gap-2 mb-6">
              <input name="title" placeholder="Titel / Adresse" required className="border border-pn-border rounded-lg px-3 py-2 text-sm flex-1 min-w-[200px]" />
              <input name="price" placeholder="Preis €" className="border border-pn-border rounded-lg px-3 py-2 text-sm w-28" />
              <input name="address" placeholder="Adresse" className="border border-pn-border rounded-lg px-3 py-2 text-sm flex-1 min-w-[160px]" />
              <button type="submit" className="bg-pn-accent text-white font-semibold px-4 py-2 rounded-lg text-sm">
                Immobilie hinzufügen
              </button>
            </form>
            )}
            <ul className="space-y-3">
              {apartments.map((a) => (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-4 bg-pn-bg-surface border border-pn-border rounded-xl p-4"
                >
                  <div className="flex gap-3 min-w-0">
                    {a.photos[0] && (
                      <Image
                        src={a.photos[0].url}
                        alt=""
                        width={64}
                        height={64}
                        className="w-16 h-16 rounded-lg object-cover shrink-0"
                      />
                    )}
                    <div className="min-w-0">
                      <Link href={`/project/${project.id}/apartment/${a.id}`} className="font-semibold hover:text-pn-accent">
                        {a.title}
                      </Link>
                      {a.address && <p className="text-sm text-pn-text-secondary">{a.address}</p>}
                      {a.price != null && <p className="text-sm font-medium">{formatPrice(a.price)}</p>}
                      {(() => {
                        const upcoming = nextViewing(a.viewings);
                        if (upcoming) {
                          return (
                            <p className="text-xs text-pn-accent mt-1">
                              Besichtigung: {formatDateDe(upcoming)}
                            </p>
                          );
                        }
                        if (a.viewedAt) {
                          return (
                            <p className="text-xs text-pn-text-tertiary mt-1">
                              Besichtigt: {formatDateDe(a.viewedAt)}
                            </p>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <ScoreBadge score={a.score} dealbreaker={a.dealbreaker} />
                    <span className="text-xs text-pn-text-tertiary">
                      {a.rated}/{a.total} bewertet
                      {pricePerPoint(a.price, a.score) && ` · ${pricePerPoint(a.price, a.score)}/Pkt`}
                    </span>
                    <Link
                      href={`/project/${project.id}/apartment/${a.id}`}
                      className="text-sm font-medium text-pn-accent hover:underline"
                    >
                      Bearbeiten / Bewerten
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
            {apartments.length === 0 && (
              <p className="text-pn-text-tertiary text-center py-8">
                {tab === "archived"
                  ? "Keine archivierten Immobilien."
                  : "Noch keine Immobilien in diesem Projekt."}
              </p>
            )}
          </>
        )}

        {tab === "criteria" && <CriteriaEditor projectId={project.id} groups={project.groups} />}

        {tab === "compare" && activeProject && (
          <CompareView
            projectId={project.id}
            apartments={activeProject.apartments.map((a) => ({
              id: a.id,
              title: a.title,
              price: a.price,
            }))}
            members={activeProject.members}
            criteria={criteriaWithGroup}
            allRatings={activeProject.apartments.flatMap((a) =>
              a.ratings.map((r) => ({ ...r, apartmentId: a.id }))
            )}
          />
        )}

        {tab === "map" && activeProject && (
          <ProjectMap
            projectId={project.id}
            apartments={activeProject.apartments.map((a) => ({
              id: a.id,
              title: a.title,
              address: a.address,
              latitude: a.latitude,
              longitude: a.longitude,
            }))}
          />
        )}

        {tab === "calendar" && activeProject && (
          <ProjectCalendar
            projectId={project.id}
            icalUrl={icalUrl}
            events={calendarEvents}
          />
        )}
      </main>
      <Footer />
    </>
  );
}

function TabLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
        active ? "border-pn-accent text-pn-accent" : "border-transparent text-pn-text-secondary hover:text-pn-text-primary"
      }`}
    >
      {children}
    </Link>
  );
}
