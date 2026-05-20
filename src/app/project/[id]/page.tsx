import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { formatDateDe } from "@/lib/dates";
import { nextViewing } from "@/lib/viewings";
import { createApartmentAction } from "@/app/actions";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { ScoreBadge } from "@/components/ScoreBadge";
import { CriteriaEditor } from "@/components/CriteriaEditor";
import { ProjectMembersPanel } from "@/components/ProjectMembersPanel";
import { ProjectSettingsPanel } from "@/components/ProjectSettingsPanel";
import { DeleteProjectButton } from "@/components/DeleteProjectButton";
import { ApartmentDeleteButton } from "@/components/ApartmentDeleteButton";
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
import { ApartmentListSort } from "@/components/ApartmentListSort";
import { ApartmentProjectSearch } from "@/components/ApartmentProjectSearch";
import { filterApartmentsBySearch } from "@/lib/apartment-search";
import { RatingProgressBar } from "@/components/RatingProgressBar";
import { ScoreLegend } from "@/components/ScoreLegend";
import {
  formatBudgetHint,
  formatPrice,
  parseApartmentSort,
  parseApartmentSortOrder,
  pricePerPoint,
  resolveDealbreakerThreshold,
  sortApartments,
} from "@/lib/scoring";

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    tab?: string;
    member_added?: string;
    member_removed?: string;
    member_error?: string;
    settings_saved?: string;
    settings_error?: string;
    reindex_processed?: string;
    reindex_text?: string;
    reindex_empty?: string;
    reindex_missing?: string;
    sort?: string;
    order?: string;
    q?: string;
  }>;
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const projectId = resolvedParams.id;
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (isAdmin(user)) redirect("/admin");

  const tab = resolvedSearchParams.tab ?? "apartments";
  const isArchivedTab = tab === "archived";

  const project = await getProjectForUser(projectId, user.id, { archived: isArchivedTab });
  if (!project) redirect("/dashboard");

  const needsActiveList = tab === "compare" || tab === "map" || tab === "calendar";
  const activeProject = needsActiveList
    ? await getProjectForUser(projectId, user.id, { archived: false })
    : null;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const icalToken =
    tab === "calendar" && activeProject ? await ensureProjectIcalToken(projectId) : null;
  const icalUrl = icalToken
    ? `${baseUrl}/api/projects/${projectId}/calendar.ics?token=${icalToken}`
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
    prisma.apartment.count({ where: { projectId, archivedAt: null, ...memberFilter } }),
    prisma.apartment.count({
      where: { projectId, archivedAt: { not: null }, ...memberFilter },
    }),
  ]);

  const criteria = flattenCriteria(project.groups);
  const dealbreakerThreshold = resolveDealbreakerThreshold(project.dealbreakerThreshold);

  const apartments = project.apartments.map((a) => {
    const result = apartmentScore(criteria, a.ratings, user.id, dealbreakerThreshold);
    return { ...a, ...result };
  });

  const sortKey = parseApartmentSort(resolvedSearchParams.sort);
  const sortOrder = parseApartmentSortOrder(resolvedSearchParams.order);
  const sortedApartments = sortApartments(apartments, sortKey, sortOrder);

  const searchQuery = resolvedSearchParams.q ?? "";
  const criterionNames = new Map(
    project.groups.flatMap((g) => g.criteria.map((c) => [c.id, c.name] as const))
  );
  const totalApartmentCount = sortedApartments.length;
  const visibleApartments = filterApartmentsBySearch(sortedApartments, searchQuery, criterionNames);

  const memberMessage = resolvedSearchParams.member_added
    ? `${resolvedSearchParams.member_added} wurde zum Projekt hinzugefügt.`
    : resolvedSearchParams.member_removed
      ? `${resolvedSearchParams.member_removed} wurde aus dem Projekt entfernt.`
      : undefined;

  const reindexProcessed = resolvedSearchParams.reindex_processed;
  const reindexResult =
    reindexProcessed != null
      ? {
          processed: parseInt(reindexProcessed, 10) || 0,
          withText: parseInt(resolvedSearchParams.reindex_text ?? "0", 10) || 0,
          withoutText: parseInt(resolvedSearchParams.reindex_empty ?? "0", 10) || 0,
          missingFile: parseInt(resolvedSearchParams.reindex_missing ?? "0", 10) || 0,
        }
      : undefined;

  return (
    <>
      <Nav userName={user.name} />
      <main className="max-w-6xl mx-auto px-4 py-8 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold">{project.name}</h1>
            {project.budget != null && (
              <p className="text-sm text-pn-text-secondary mt-1">Budget: {formatPrice(project.budget)}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
          <TabLink href={`/project/${project.id}?tab=team`} active={tab === "team"}>
            Team ({project.members.length})
          </TabLink>
          <TabLink href={`/project/${project.id}?tab=settings`} active={tab === "settings"}>
            Einstellungen
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
            <form action={createApartmentAction.bind(null, project.id)} className="flex flex-wrap gap-2 mb-6 items-center">
              <input name="title" placeholder="Titel / Adresse" required className="border border-pn-border rounded-lg px-3 py-2 text-sm flex-1 min-w-[200px]" />
              <input name="price" placeholder="Preis €" className="border border-pn-border rounded-lg px-3 py-2 text-sm w-28" />
              <input name="address" placeholder="Adresse" className="border border-pn-border rounded-lg px-3 py-2 text-sm flex-1 min-w-[160px]" />
              <input name="listingUrl" placeholder="Inserat-URL" type="url" className="border border-pn-border rounded-lg px-3 py-2 text-sm flex-1 min-w-[180px]" />
              <label className="flex items-center gap-1.5 text-sm text-pn-text-secondary whitespace-nowrap">
                <input type="checkbox" name="brokerInvolved" className="rounded border-pn-border" />
                Makler
              </label>
              <button type="submit" className="bg-pn-accent text-white font-semibold px-4 py-2 rounded-lg text-sm">
                Immobilie hinzufügen
              </button>
            </form>
            )}
            <ScoreLegend className="mb-4" />
            <ApartmentProjectSearch
              projectId={project.id}
              tab={tab}
              sort={sortKey}
              order={sortOrder}
              query={searchQuery}
              resultCount={visibleApartments.length}
              totalCount={totalApartmentCount}
            />
            <ApartmentListSort
              projectId={project.id}
              tab={tab}
              current={sortKey}
              currentOrder={sortOrder}
              searchQuery={searchQuery}
            />
            <ul className="space-y-3">
              {visibleApartments.map((a) => (
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
                      {a.listingUrl && (
                        <a
                          href={a.listingUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-pn-accent hover:underline block mt-0.5"
                        >
                          Inserat öffnen ↗
                        </a>
                      )}
                      {a.address && <p className="text-sm text-pn-text-secondary">{a.address}</p>}
                      {a.price != null && (
                        <p className="text-sm font-medium">
                          {formatPrice(a.price)}
                          {project.budget != null && (
                            <span
                              className={`block text-xs font-normal mt-0.5 ${
                                a.price > project.budget
                                  ? "text-pn-score-low"
                                  : a.price < project.budget
                                    ? "text-pn-score-high"
                                    : "text-pn-text-tertiary"
                              }`}
                            >
                              {formatBudgetHint(a.price, project.budget)}
                            </span>
                          )}
                        </p>
                      )}
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
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 min-w-[140px]">
                    <div className="flex flex-col items-end gap-2 flex-1">
                      <ScoreBadge score={a.score} dealbreaker={a.dealbreaker} />
                      <RatingProgressBar rated={a.rated} total={a.total} />
                      {pricePerPoint(a.price, a.score) && (
                        <span className="text-xs text-pn-text-tertiary">
                          {pricePerPoint(a.price, a.score)}/Pkt
                        </span>
                      )}
                    </div>
                    <Link
                      href={`/project/${project.id}/apartment/${a.id}`}
                      aria-label="Immobilie bearbeiten"
                      title="Bearbeiten / Bewerten"
                      className="inline-flex items-center justify-center w-9 h-9 border border-pn-border rounded-lg text-pn-text-secondary hover:bg-pn-bg-subtle hover:text-pn-accent shrink-0 self-center"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="w-4 h-4"
                        aria-hidden="true"
                      >
                        <path d="m2.695 14.762-1.262 3.34a.75.75 0 0 0 1.018 1.018l3.34-1.262a4.5 4.5 0 0 0 1.897-.923l.337-.337-3.993-3.993-.337.337a4.5 4.5 0 0 0-.923 1.897ZM12.75 4.5l3.993 3.993-7.184 7.184a5.25 5.25 0 0 1-1.32 1.1l-2.065.783.783-2.065a5.25 5.25 0 0 1 1.1-1.32L12.75 4.5Z" />
                      </svg>
                    </Link>
                    {tab === "archived" && <ApartmentDeleteButton apartmentId={a.id} compact />}
                  </div>
                </li>
              ))}
            </ul>
            {totalApartmentCount === 0 && (
              <p className="text-pn-text-tertiary text-center py-8">
                {tab === "archived"
                  ? "Keine archivierten Immobilien."
                  : "Noch keine Immobilien in diesem Projekt."}
              </p>
            )}
            {totalApartmentCount > 0 && visibleApartments.length === 0 && searchQuery.trim() && (
              <p className="text-pn-text-tertiary text-center py-8">
                Keine Immobilien passen zur Suche.
              </p>
            )}
          </>
        )}

        {tab === "settings" && (
          <ProjectSettingsPanel
            projectId={project.id}
            name={project.name}
            budget={project.budget}
            federalStateCode={project.federalStateCode}
            brokerBuyerRate={project.brokerBuyerRate}
            equityAmount={project.equityAmount}
            loanTermYears={project.loanTermYears}
            interestRate={project.interestRate}
            netHouseholdIncome={project.netHouseholdIncome}
            dealbreakerThreshold={dealbreakerThreshold}
            saved={resolvedSearchParams.settings_saved === "1"}
            error={resolvedSearchParams.settings_error}
            reindexResult={reindexResult}
          />
        )}

        {tab === "team" && (
          <ProjectMembersPanel
            projectId={project.id}
            members={project.members}
            currentUserId={user.id}
            message={memberMessage}
            error={resolvedSearchParams.member_error}
          />
        )}

        {tab === "criteria" && (
          <CriteriaEditor
            projectId={project.id}
            groups={project.groups}
            dealbreakerThreshold={dealbreakerThreshold}
          />
        )}

        {tab === "compare" && activeProject && (
          <CompareView
            projectId={project.id}
            apartments={activeProject.apartments.map((a) => ({
              id: a.id,
              title: a.title,
              address: a.address,
              price: a.price,
              sizeSqm: a.sizeSqm,
              brokerInvolved: a.brokerInvolved,
            }))}
            finance={{
              federalStateCode: activeProject.federalStateCode,
              brokerBuyerRate: activeProject.brokerBuyerRate,
              equityAmount: activeProject.equityAmount,
              loanTermYears: activeProject.loanTermYears,
              interestRate: activeProject.interestRate,
              netHouseholdIncome: activeProject.netHouseholdIncome,
            }}
            members={activeProject.members}
            criteria={criteriaWithGroup}
            allRatings={activeProject.apartments.flatMap((a) =>
              a.ratings.map((r) => ({ ...r, apartmentId: a.id }))
            )}
            dealbreakerThreshold={resolveDealbreakerThreshold(activeProject.dealbreakerThreshold)}
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
