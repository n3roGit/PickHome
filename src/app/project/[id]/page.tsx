import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { formatDateDe } from "@/lib/dates";
import { nextViewing } from "@/lib/viewings";
import { ListingImportAssist } from "@/components/ListingImportAssist";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { ScoreBadge } from "@/components/ScoreBadge";
import { CriteriaEditor } from "@/components/CriteriaEditor";
import { ProjectMembersPanel } from "@/components/ProjectMembersPanel";
import { ProjectSettingsPanel } from "@/components/ProjectSettingsPanel";
import { ProjectAreaFilterPanel } from "@/components/ProjectAreaFilterPanel";
import { DesiredAreaBadge } from "@/components/DesiredAreaBadge";
import { DeleteProjectButton } from "@/components/DeleteProjectButton";
import { ApartmentDeleteButton } from "@/components/ApartmentDeleteButton";
import { CompareView } from "@/components/CompareView";
import { ProjectMap } from "@/components/ProjectMap";
import { ProjectCalendar } from "@/components/ProjectCalendar";
import { getSessionUser, isAdmin } from "@/lib/auth";
import { nestedProjectAccessFilter } from "@/lib/project-access";
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
import { DuplicateApartmentBadge } from "@/components/DuplicateApartmentBadge";
import { archiveReasonLabel } from "@/lib/archive-reasons";
import { buildDuplicateIndex } from "@/lib/apartment-duplicates";
import { maxNotableDivergence, partnerComparisons } from "@/lib/rating-divergence";
import {
  isAreaFilterActive,
  matchApartmentToAreaFilter,
  parseAreaFilterConfig,
} from "@/lib/area-filter";
import { findOrtByKey, getPlzReferenceData } from "@/lib/plz-reference";
import { mergeDistrictsByPlz } from "@/lib/ortsteile-reference";
import { fetchProjectAreaDistricts } from "@/lib/project-area-data";
import { resolvePlzMapOverlays } from "@/lib/plz-map-overlays";
import { CollapsibleSection } from "@/components/CollapsibleSection";

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
    commute_apartments?: string;
    commute_with_coords?: string;
    commute_routes?: string;
    commute_skipped?: string;
    commute_failed?: string;
    areas_saved?: string;
    areas_error?: string;
    districts_saved?: string;
    districts_cleared?: string;
    districts_error?: string;
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
  const admin = isAdmin(user);

  const tab = resolvedSearchParams.tab ?? "apartments";
  const isArchivedTab = tab === "archived";

  const project = await getProjectForUser(projectId, user, { archived: isArchivedTab });
  if (!project) redirect("/dashboard");

  const needsActiveList = tab === "compare" || tab === "map" || tab === "calendar";
  const activeProject = needsActiveList
    ? await getProjectForUser(projectId, user, { archived: false })
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

  const memberFilter = { project: nestedProjectAccessFilter(user) };
  const [activeCount, archivedCount] = await Promise.all([
    prisma.apartment.count({ where: { projectId, archivedAt: null, ...memberFilter } }),
    prisma.apartment.count({
      where: { projectId, archivedAt: { not: null }, ...memberFilter },
    }),
  ]);

  const criteria = flattenCriteria(project.groups);
  const criteriaWithName = project.groups.flatMap((g) =>
    g.criteria.map((c) => ({ ...c, name: c.name }))
  );
  const dealbreakerThreshold = resolveDealbreakerThreshold(project.dealbreakerThreshold);
  const partnerMembers = project.members
    .filter((m) => m.userId !== user.id)
    .map((m) => ({ userId: m.userId, name: m.user.name }));
  const allRatingsForDivergence = project.apartments.flatMap((a) =>
    a.ratings.map((r) => ({ ...r, apartmentId: a.id }))
  );

  const duplicateIndex = buildDuplicateIndex(
    project.apartments.map((a) => ({ id: a.id, title: a.title, address: a.address }))
  );

  const plzReference = getPlzReferenceData();
  const projectAreaDistricts = await fetchProjectAreaDistricts(projectId);
  const districtsByPlz = mergeDistrictsByPlz(projectAreaDistricts);
  const areaFilterConfig = parseAreaFilterConfig(project.areaFilterConfig);
  const areaFilterEnabled = isAreaFilterActive(project.areaFilterOrtKey, areaFilterConfig);
  const initialOrt = findOrtByKey(project.areaFilterOrtKey ?? "");
  const areaFilterSummary =
    areaFilterEnabled && initialOrt && areaFilterConfig
      ? `${initialOrt.name} · ${areaFilterConfig.selectedPlz.length} PLZ`
      : undefined;
  const areaFilterPlzOverlays =
    tab === "map" && areaFilterEnabled && areaFilterConfig && activeProject
      ? await resolvePlzMapOverlays(areaFilterConfig.selectedPlz, activeProject.apartments, {
          geocode: false,
        })
      : [];

  const apartments = project.apartments.map((a) => {
    const result = apartmentScore(criteria, a.ratings, user.id, dealbreakerThreshold);
    const divergence =
      partnerMembers.length > 0
        ? maxNotableDivergence(
            partnerComparisons({
              criteria: criteriaWithName,
              ratings: allRatingsForDivergence,
              apartmentId: a.id,
              currentUserId: user.id,
              partners: partnerMembers,
              dealbreakerThreshold,
            })
          )
        : null;
    const areaMatch = matchApartmentToAreaFilter(
      a.address,
      project.areaFilterOrtKey,
      areaFilterConfig,
      districtsByPlz
    );
    return {
      ...a,
      ...result,
      divergence,
      duplicateMatches: duplicateIndex.get(a.id) ?? [],
      areaMatch,
    };
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

  const commuteRoutes = resolvedSearchParams.commute_routes;
  const commuteReindexResult =
    commuteRoutes != null
      ? {
          apartmentsTotal: parseInt(resolvedSearchParams.commute_apartments ?? "0", 10) || 0,
          apartmentsWithCoords:
            parseInt(resolvedSearchParams.commute_with_coords ?? "0", 10) || 0,
          routesComputed: parseInt(commuteRoutes, 10) || 0,
          routesSkipped: parseInt(resolvedSearchParams.commute_skipped ?? "0", 10) || 0,
          routesFailed: parseInt(resolvedSearchParams.commute_failed ?? "0", 10) || 0,
        }
      : undefined;

  const archiveReasonStats =
    tab === "archived" && archivedCount > 0
      ? await prisma.apartment.groupBy({
          by: ["archiveReason"],
          where: { projectId, archivedAt: { not: null } },
          _count: { _all: true },
        })
      : [];

  return (
    <>
      <Nav userName={user.name} isAdmin={admin} />
      <main className="max-w-6xl mx-auto px-4 py-6 sm:py-8 flex-1 min-w-0 w-full">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold break-words">{project.name}</h1>
            {project.budget != null && (
              <p className="text-sm text-pn-text-secondary mt-1">Budget: {formatPrice(project.budget)}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DeleteProjectButton projectId={project.id} projectName={project.name} />
          </div>
        </div>

        <div className="pn-scroll-x mb-6">
          <div className="pn-tabs">
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
        </div>

        {(tab === "apartments" || tab === "archived") && (
          <>
            {tab === "archived" && archiveReasonStats.length > 0 && (
              <section className="mb-6 bg-pn-bg-subtle border border-pn-border rounded-xl p-4">
                <h2 className="text-sm font-semibold mb-2">Ablehnungsmuster</h2>
                <ul className="text-sm text-pn-text-secondary space-y-1">
                  {archiveReasonStats
                    .filter((s) => s.archiveReason)
                    .sort((a, b) => b._count._all - a._count._all)
                    .map((s) => (
                      <li key={s.archiveReason ?? "unknown"}>
                        {archiveReasonLabel(s.archiveReason) ?? s.archiveReason}:{" "}
                        <span className="font-medium text-pn-text-primary">{s._count._all}×</span>
                      </li>
                    ))}
                </ul>
              </section>
            )}
            {tab === "apartments" && <ListingImportAssist projectId={project.id} />}
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
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-pn-bg-surface border border-pn-border rounded-xl p-4"
                >
                  <div className="flex gap-3 min-w-0 flex-1">
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
                      {areaFilterEnabled && (
                        <DesiredAreaBadge status={a.areaMatch.status} className="mt-1" />
                      )}
                      {tab === "archived" && a.archiveReason && (
                        <p className="text-xs text-pn-text-tertiary mt-1">
                          Grund: {archiveReasonLabel(a.archiveReason)}
                          {a.archiveNote ? ` — ${a.archiveNote}` : ""}
                        </p>
                      )}
                      <DuplicateApartmentBadge
                        projectId={project.id}
                        matches={a.duplicateMatches}
                      />
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
                  <div className="flex flex-col items-stretch sm:items-end gap-2 w-full sm:w-auto sm:min-w-[140px] shrink-0">
                    <div className="flex flex-wrap justify-start sm:justify-end gap-2">
                    <ScoreBadge
                      score={a.score}
                      displayScore={a.displayScore}
                      dealbreaker={a.dealbreaker}
                    />
                    {a.divergence && (
                      <span
                        className="inline-flex items-center text-xs font-medium text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full"
                        title={`Abweichung zu ${a.divergence.partnerName}`}
                      >
                        Δ {a.divergence.delta}
                      </span>
                    )}
                    </div>
                    <RatingProgressBar rated={a.rated} total={a.total} className="w-full" />
                    {pricePerPoint(a.price, a.displayScore) && (
                      <span className="text-xs text-pn-text-tertiary">
                        {pricePerPoint(a.price, a.displayScore)}/Pkt
                      </span>
                    )}
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
            commuteReindexResult={commuteReindexResult}
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
            currentUserId={user.id}
          />
        )}

        {tab === "map" && activeProject && (
          <div className="space-y-10">
            <ProjectMap
              key="project-map"
              projectId={project.id}
              areaFilterEnabled={areaFilterEnabled}
              areaFilterPlzOverlays={areaFilterPlzOverlays}
              apartments={activeProject.apartments.map((a) => {
                const scored = apartmentScore(
                  criteria,
                  a.ratings,
                  user.id,
                  dealbreakerThreshold
                );
                const areaMatch = matchApartmentToAreaFilter(
                  a.address,
                  project.areaFilterOrtKey,
                  areaFilterConfig,
                  districtsByPlz
                );
                return {
                  id: a.id,
                  title: a.title,
                  address: a.address,
                  latitude: a.latitude,
                  longitude: a.longitude,
                  score: scored.score,
                  displayScore: scored.displayScore,
                  dealbreaker: scored.dealbreaker,
                  areaMatchStatus: areaMatch.status,
                };
              })}
            />
            <CollapsibleSection title="Wunschgebiet" defaultOpen={false} headerAside={areaFilterSummary}>
              <ProjectAreaFilterPanel
                projectId={project.id}
                saved={resolvedSearchParams.areas_saved === "1"}
                error={resolvedSearchParams.areas_error}
                districtsSaved={resolvedSearchParams.districts_saved === "1"}
                districtsCleared={resolvedSearchParams.districts_cleared === "1"}
                districtsError={resolvedSearchParams.districts_error}
                bundeslaender={plzReference.bundeslaender}
                initialOrt={initialOrt}
                districtsByPlz={districtsByPlz}
                projectAreaDistricts={projectAreaDistricts}
                initial={{
                  ortKey: project.areaFilterOrtKey,
                  config: areaFilterConfig,
                }}
              />
            </CollapsibleSection>
          </div>
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
      className={`px-3 sm:px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap shrink-0 ${
        active ? "border-pn-accent text-pn-accent" : "border-transparent text-pn-text-secondary hover:text-pn-text-primary"
      }`}
    >
      {children}
    </Link>
  );
}
