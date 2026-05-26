import dynamic from "next/dynamic";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { ApartmentPdfDialog } from "@/components/ApartmentPdfDialog";
import { APARTMENT_TOOLBAR_BTN_NEUTRAL } from "@/lib/apartment-toolbar-styles";
import { ApartmentLiveScoreSummary } from "@/components/ApartmentLiveScoreSummary";
import { ApartmentScoreProvider } from "@/components/ApartmentScoreProvider";
import { ApartmentDocuments } from "@/components/ApartmentDocuments";
import { RatingSliders } from "@/components/RatingSliders";
import { ViewingAppointments } from "@/components/ViewingAppointments";
import { countApartmentPriceHistory } from "@/lib/apartment-price-history";
import { getAppTimeZone } from "@/lib/app-settings";
import { getSessionUser, isAdmin } from "@/lib/auth";
import { ApartmentBasicsForm } from "@/components/ApartmentBasicsForm";
import { ApartmentArchiveButton } from "@/components/ApartmentArchiveButton";
import { ApartmentDeleteButton } from "@/components/ApartmentDeleteButton";
import { ApartmentDescriptionForm } from "@/components/ApartmentDescriptionForm";
import { ApartmentListingUrlForm } from "@/components/ApartmentListingUrlForm";
import { ApartmentNotesForm } from "@/components/ApartmentNotesForm";
import { ApartmentTitleForm } from "@/components/ApartmentTitleForm";
import { ApartmentPurchaseCosts } from "@/components/ApartmentPurchaseCosts";
import { ApartmentSubsidyPanel } from "@/components/ApartmentSubsidyPanel";
import { ApartmentCommutePanel } from "@/components/ApartmentCommutePanel";
import { computeCommuteForMembers } from "@/lib/commute";
import { prisma } from "@/lib/prisma";
import { parseCompanyCarCommuteMethod, parseCompanyCarRate } from "@/lib/company-car";
import { resolveTransitSettings } from "@/lib/transit-settings";
import { parseTravelMode } from "@/lib/travel-mode";
import {
  apartmentScore,
  flattenCriteria,
  getApartmentForUser,
  getProjectChecklistItems,
  getProjectMetaForUser,
} from "@/lib/project-data";
import { PartnerDivergencePanel } from "@/components/PartnerDivergencePanel";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { ScoreLegend } from "@/components/ScoreLegend";
import { DuplicateApartmentBadge } from "@/components/DuplicateApartmentBadge";
import { DesiredAreaBadge } from "@/components/DesiredAreaBadge";
import { findDuplicatesForApartment } from "@/lib/apartment-duplicates";
import { partnerComparisons } from "@/lib/rating-divergence";
import { resolveDealbreakerThreshold } from "@/lib/scoring";
import {
  isAreaFilterActive,
  areaFilterMode,
  matchApartmentToAreaFilter,
  parseAreaFilterConfig,
} from "@/lib/area-filter";
import { mergeDistrictsByPlz } from "@/lib/ortsteile-reference";
import { fetchProjectAreaDistricts } from "@/lib/project-area-data";
import { apartmentLlmHasSourceText } from "@/lib/apartment-llm-context";
import { isLlmConfigured } from "@/lib/llm-client";
import { ApartmentAutoFillButton } from "@/components/ApartmentAutoFillButton";
import { ApartmentConflictBanner } from "@/components/ApartmentConflictBanner";
import { ApartmentListingDraftRestore } from "@/components/ApartmentListingDraftRestore";
import { ApartmentListingFieldSuggestions } from "@/components/ApartmentListingFieldSuggestions";
import { ApartmentUnsavedGuard } from "@/components/ApartmentUnsavedGuard";
import { ApartmentLlmChatButton } from "@/components/ApartmentLlmChatButton";
import { ApartmentChecklistExtras } from "@/components/ApartmentChecklistExtras";
import { ApartmentPhotoCameraButton } from "@/components/ApartmentPhotoCameraButton";
import type { ChecklistCriterionHint } from "@/components/RatingSliders";
import {
  hasChecklistInfo,
  userCanFillChecklistItem,
} from "@/lib/checklist-display";
import { getProjectViewingScheduleSlots } from "@/lib/viewing-schedule-data";
import {
  buildViewingScheduleWarningsAsync,
  viewingWarningsToRecord,
} from "@/lib/viewing-schedule-conflicts";
import {
  countSubsidyHints,
  matchApartmentSubsidies,
} from "@/lib/subsidy-matching";
import { getOrFetchBorisForApartment } from "@/lib/boris-cache";

const ApartmentPhotos = dynamic(() => import("@/components/ApartmentPhotos"));

export default async function ApartmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; aptId: string }>;
  searchParams: Promise<{
    title_saved?: string;
    title_error?: string;
    listing_saved?: string;
    listing_error?: string;
    notes_saved?: string;
    description_saved?: string;
    basics_saved?: string;
    broker_saved?: string;
    address_unresolved?: string;
    address_geocoded?: string;
    address_geocode_failed?: string;
    conflict?: string;
  }>;
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const admin = isAdmin(user);

  const project = await getProjectMetaForUser(resolvedParams.id, user);
  if (!project) redirect("/dashboard");

  const apartment = await getApartmentForUser(resolvedParams.id, resolvedParams.aptId, user);
  if (!apartment) redirect(`/project/${project.id}`);

  const criteria = flattenCriteria(project.groups);
  const criteriaWithName = project.groups.flatMap((g) =>
    g.criteria.map((c) => ({ ...c, name: c.name }))
  );
  const dealbreakerThreshold = resolveDealbreakerThreshold(project.dealbreakerThreshold);
  const partnerMembers = project.members
    .filter((m) => m.userId !== user.id)
    .map((m) => ({ userId: m.userId, name: m.user.name }));
  const siblingApartments = await prisma.apartment.findMany({
    where: { projectId: project.id, id: { not: apartment.id } },
    select: { id: true, title: true, address: true },
  });
  const duplicateMatches = findDuplicatesForApartment(
    { id: apartment.id, title: apartment.title, address: apartment.address },
    siblingApartments
  );

  const divergenceComparisons = partnerComparisons({
    criteria: criteriaWithName,
    ratings: apartment.ratings.map((r) => ({ ...r, apartmentId: apartment.id })),
    apartmentId: apartment.id,
    currentUserId: user.id,
    partners: partnerMembers,
    dealbreakerThreshold,
  });
  const myScore = apartmentScore(criteria, apartment.ratings, user.id, dealbreakerThreshold);
  const archived = apartment.archivedAt != null;
  const appTimeZone = await getAppTimeZone();
  const priceHistoryCount = await countApartmentPriceHistory(apartment.id);
  const llmEnabled = await isLlmConfigured();
  const llmContext = {
    projectName: project.name,
    title: apartment.title,
    address: apartment.address,
    listingUrl: apartment.listingUrl,
    price: apartment.price,
    sizeSqm: apartment.sizeSqm,
    plotSizeSqm: apartment.plotSizeSqm,
    floor: apartment.floor,
    yearBuilt: apartment.yearBuilt,
    energyClass: apartment.energyClass,
    brokerInvolved: apartment.brokerInvolved,
    hoaFeeMonthly: apartment.hoaFeeMonthly,
    heatingCostMonthly: apartment.heatingCostMonthly,
    propertyTaxAnnual: apartment.propertyTaxAnnual,
    renovationCost: apartment.renovationCost,
    description: apartment.description,
    notes: apartment.notes,
    documents: apartment.documents.map((d) => ({
      fileName: d.fileName,
      extractedText: d.extractedText,
    })),
  };
  const llmHasSourceText = apartmentLlmHasSourceText(llmContext);

  const areaFilterConfig = parseAreaFilterConfig(project.areaFilterConfig);
  const projectAreaDistricts = await fetchProjectAreaDistricts(resolvedParams.id);
  const districtsByPlz = mergeDistrictsByPlz(projectAreaDistricts);
  const areaFilterEnabled = isAreaFilterActive(project.areaFilterOrtKey, areaFilterConfig);
  const areaFilterModeValue = areaFilterMode(areaFilterConfig);
  const areaMatch = matchApartmentToAreaFilter(
    apartment.address,
    project.areaFilterOrtKey,
    areaFilterConfig,
    districtsByPlz
  );

  const groupsWithRatings = project.groups.map((g) => ({
    id: g.id,
    name: g.name,
    criteria: g.criteria.map((c) => ({
      ...c,
      rating: apartment.ratings.find((r) => r.criterionId === c.id && r.userId === user.id),
    })),
  }));

  const memberUsers = await prisma.user.findMany({
    where: { id: { in: project.members.map((m) => m.userId) } },
    select: {
      id: true,
      name: true,
      travelMode: true,
      transitArrivalHour: true,
      transitArrivalMinute: true,
      transitArrivalWeekday: true,
      transitFallbackMaxKm: true,
      transitFallbackMode: true,
      companyCar: true,
      companyCarRate: true,
      listPrice: true,
      marginalTaxRatePercent: true,
      companyCarCommuteMethod: true,
      companyCarOfficeTripsPerMonth: true,
      companyCarContributionEur: true,
      companyCarSelfPaidCostsEur: true,
      companyCarEmployerFuelCard: true,
      commuteAllowanceDaysPerYear: true,
      commuteAllowanceVacationDays: true,
      commuteAllowanceSickDays: true,
      commuteAllowanceHomeOfficeDays: true,
      addresses: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
    },
  });
  const apartmentCoords =
    apartment.latitude != null && apartment.longitude != null
      ? { latitude: apartment.latitude, longitude: apartment.longitude }
      : null;
  const commutePeople = await computeCommuteForMembers({
    apartmentId: apartment.id,
    apartment: apartmentCoords,
    apartmentAddress: apartment.address ?? apartment.title,
    currentUserId: user.id,
    cacheOnly: true,
    members: memberUsers.map((member) => ({
      userId: member.id,
      name: member.name,
      travelMode: parseTravelMode(member.travelMode),
      transitSettings:
        parseTravelMode(member.travelMode) === "transit"
          ? resolveTransitSettings(member)
          : null,
      companyCar: member.companyCar,
      companyCarRate: member.companyCar ? parseCompanyCarRate(member.companyCarRate) : null,
      listPrice: member.listPrice,
      marginalTaxRatePercent: member.marginalTaxRatePercent,
      companyCarCommuteMethod: member.companyCar
        ? parseCompanyCarCommuteMethod(member.companyCarCommuteMethod)
        : null,
      companyCarOfficeTripsPerMonth: member.companyCar ? member.companyCarOfficeTripsPerMonth : null,
      companyCarContributionEur: member.companyCar ? member.companyCarContributionEur : null,
      companyCarSelfPaidCostsEur: member.companyCar ? member.companyCarSelfPaidCostsEur : null,
      companyCarEmployerFuelCard: member.companyCar ? member.companyCarEmployerFuelCard : true,
      commuteAllowanceDaysPerYear: member.commuteAllowanceDaysPerYear,
      commuteAllowanceVacationDays: member.commuteAllowanceVacationDays,
      commuteAllowanceSickDays: member.commuteAllowanceSickDays,
      commuteAllowanceHomeOfficeDays: member.commuteAllowanceHomeOfficeDays,
      addresses: member.addresses.map((a) => ({
        id: a.id,
        label: a.label,
        address: a.address,
        latitude: a.latitude,
        longitude: a.longitude,
        isWorkplace: a.isWorkplace,
      })),
    })),
  });

  const checklistItems = await getProjectChecklistItems(project.id);
  const entryByItemId = new Map(
    apartment.checklistEntries.map((e) => [e.itemId, e])
  );
  const checklistEditHref = `/project/${project.id}/apartment/${apartment.id}/checklist`;

  const viewingScheduleSlots = await getProjectViewingScheduleSlots(project.id, user);
  const scheduleWarnings = viewingWarningsToRecord(
    await buildViewingScheduleWarningsAsync(viewingScheduleSlots, appTimeZone)
  );

  const checklistByCriterionId: Record<string, ChecklistCriterionHint> = {};
  for (const item of checklistItems) {
    if (!item.criterionId) continue;
    const entry = entryByItemId.get(item.id);
    if (!entry || !hasChecklistInfo(entry)) continue;
    checklistByCriterionId[item.criterionId] = {
      status: entry.status,
      note: entry.note,
      canEdit: userCanFillChecklistItem(item.assigneeUserId, user.id),
    };
  }

  const extraEntries = checklistItems
    .filter((item) => !item.criterionId)
    .map((item) => {
      const entry = entryByItemId.get(item.id);
      return {
        itemId: item.id,
        name: item.name?.trim() ?? "",
        groupName: item.criterionGroup.name,
        status: entry?.status ?? "unset",
        note: entry?.note ?? null,
      };
    })
    .filter((e) => e.name);

  const partners = project.members
    .filter((m) => m.userId !== user.id)
    .map((m) => {
      const partnerRatings = apartment.ratings.filter((r) => r.userId === m.userId);
      const result = apartmentScore(criteria, partnerRatings, m.userId, dealbreakerThreshold);
      return {
        userId: m.userId,
        name: m.user.name,
        ratings: partnerRatings.map((r) => ({
          criterionId: r.criterionId,
          score: r.score,
          note: r.note,
        })),
        score: result.score,
        displayScore: result.displayScore,
        dealbreaker: result.dealbreaker,
        rated: result.rated,
      };
    });

  const listingDraftSaved = {
    title: resolvedSearchParams.title_saved === "1",
    description: resolvedSearchParams.description_saved === "1",
    basics: resolvedSearchParams.basics_saved === "1",
    broker: resolvedSearchParams.broker_saved === "1",
  };

  const unsavedResetKey = [
    resolvedSearchParams.title_saved,
    resolvedSearchParams.listing_saved,
    resolvedSearchParams.notes_saved,
    resolvedSearchParams.description_saved,
    resolvedSearchParams.basics_saved,
    resolvedSearchParams.broker_saved,
    apartment.revision,
  ].join("|");

  const subsidyMatches = matchApartmentSubsidies({
    energyClass: apartment.energyClass,
    yearBuilt: apartment.yearBuilt,
    renovationCost: apartment.renovationCost,
    address: apartment.address,
  });
  const subsidyHintCount = countSubsidyHints(subsidyMatches);
  const borisSnapshot = await getOrFetchBorisForApartment(prisma, apartment.id);

  return (
    <>
      <Nav userName={user.name} isAdmin={admin} />
      <main className="max-w-4xl mx-auto px-4 py-6 sm:py-8 flex-1 min-w-0 w-full">
        <ApartmentUnsavedGuard apartmentId={apartment.id} resetKey={unsavedResetKey}>
        <ApartmentListingDraftRestore
          apartmentId={apartment.id}
          resetKey={unsavedResetKey}
          saved={listingDraftSaved}
        />
        <ApartmentListingFieldSuggestions
          apartmentId={apartment.id}
          resetKey={unsavedResetKey}
        />
        <div id={`apartment-page-${apartment.id}`}>
        <ApartmentScoreProvider initial={myScore}>
        <Link
          href={archived ? `/project/${project.id}?tab=archived` : `/project/${project.id}`}
          className="text-sm text-pn-accent hover:underline mb-4 inline-block"
        >
          ← Zurück zu {project.name}
        </Link>
        <div className="mb-4">
          <ApartmentTitleForm
            apartmentId={apartment.id}
            revision={apartment.revision}
            title={apartment.title}
            saved={resolvedSearchParams.title_saved === "1"}
            empty={resolvedSearchParams.title_error === "empty"}
          />
          {archived && (
            <span className="inline-block mt-1 text-xs font-medium text-pn-text-secondary bg-pn-bg-subtle px-2 py-0.5 rounded">
              Archiviert
            </span>
          )}
          {apartment.listingUrl && (
            <a
              href={apartment.listingUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-pn-accent hover:underline mt-2 inline-block"
            >
              Inserat öffnen ↗
            </a>
          )}
          <DuplicateApartmentBadge projectId={project.id} matches={duplicateMatches} />
          {areaFilterEnabled && (
            <div className="mt-2">
              <DesiredAreaBadge status={areaMatch.status} mode={areaFilterModeValue} />
            </div>
          )}
        </div>
        <ApartmentLiveScoreSummary userName={user.name} viewedAt={apartment.viewedAt} />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-6">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <Link href={checklistEditHref} className={APARTMENT_TOOLBAR_BTN_NEUTRAL}>
              Checkliste
            </Link>
            <ApartmentPhotoCameraButton apartmentId={apartment.id} />
            {llmEnabled && (
              <ApartmentLlmChatButton
                apartmentId={apartment.id}
                hasSourceText={llmHasSourceText}
                toolbar
              />
            )}
            <ApartmentAutoFillButton
              apartmentId={apartment.id}
              listingUrl={apartment.listingUrl}
              toolbar
            />
          </div>
          <div
            className="hidden sm:block w-px h-6 bg-pn-border shrink-0"
            aria-hidden
          />
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <ApartmentPdfDialog apartmentId={apartment.id} />
            <ApartmentArchiveButton apartmentId={apartment.id} archived={archived} toolbar />
            <ApartmentDeleteButton apartmentId={apartment.id} toolbar />
          </div>
        </div>
        <ScoreLegend className="mb-6" />
        {resolvedSearchParams.conflict === "1" && <ApartmentConflictBanner />}
        <ApartmentBasicsForm
          projectId={project.id}
          apartmentId={apartment.id}
          revision={apartment.revision}
          address={apartment.address}
          latitude={apartment.latitude}
          longitude={apartment.longitude}
          price={apartment.price}
          priceHistoryCount={priceHistoryCount}
          timeZone={appTimeZone}
          sizeSqm={apartment.sizeSqm}
          plotSizeSqm={apartment.plotSizeSqm}
          yearBuilt={apartment.yearBuilt}
          energyClass={apartment.energyClass}
          hoaFeeMonthly={apartment.hoaFeeMonthly}
          heatingCostMonthly={apartment.heatingCostMonthly}
          propertyTaxAnnual={apartment.propertyTaxAnnual}
          renovationCost={apartment.renovationCost}
          coldRentMonthly={apartment.coldRentMonthly}
          budget={project.budget}
          saved={resolvedSearchParams.basics_saved === "1"}
          addressUnresolved={resolvedSearchParams.address_unresolved === "1"}
          addressGeocoded={resolvedSearchParams.address_geocoded === "1"}
          addressGeocodeFailed={
            resolvedSearchParams.address_geocode_failed === "empty"
              ? "empty"
              : resolvedSearchParams.address_geocode_failed === "1"
                ? "unresolved"
                : undefined
          }
        />
        <ApartmentListingUrlForm
          apartmentId={apartment.id}
          revision={apartment.revision}
          listingUrl={apartment.listingUrl}
          saved={resolvedSearchParams.listing_saved === "1"}
          invalid={resolvedSearchParams.listing_error === "invalid"}
        />
        <ApartmentCommutePanel
          people={commutePeople}
          settingsHref="/account/settings"
          viewerIsAdmin={admin}
        />
        <ApartmentPurchaseCosts
          apartmentId={apartment.id}
          revision={apartment.revision}
          price={apartment.price}
          address={apartment.address}
          federalStateCode={project.federalStateCode}
          brokerBuyerRate={project.brokerBuyerRate}
          brokerInvolved={apartment.brokerInvolved}
          coldRentMonthly={apartment.coldRentMonthly}
          hoaFeeMonthly={apartment.hoaFeeMonthly}
          heatingCostMonthly={apartment.heatingCostMonthly}
          propertyTaxAnnual={apartment.propertyTaxAnnual}
          renovationCost={apartment.renovationCost}
          plotSizeSqm={apartment.plotSizeSqm}
          sizeSqm={apartment.sizeSqm}
          equityAmount={project.equityAmount}
          loanTermYears={project.loanTermYears}
          interestRate={project.interestRate}
          netHouseholdIncome={project.netHouseholdIncome}
          monthlyFixedCosts={project.monthlyFixedCosts}
          settingsHref={`/project/${project.id}?tab=settings`}
          borisSnapshot={borisSnapshot}
        />
        <CollapsibleSection
          title="Förderungen prüfen"
          subtitle="Unverbindliche Hinweise auf mögliche KfW-/BAFA-Programme."
          defaultOpen={false}
          headerAside={`${subsidyHintCount} Hinweise`}
        >
          <ApartmentSubsidyPanel matches={subsidyMatches} />
        </CollapsibleSection>
        <ApartmentPhotos
          apartmentId={apartment.id}
          photos={apartment.photos.map((p) => ({
            id: p.id,
            url: p.url,
            thumbUrl: p.thumbUrl,
            caption: p.caption,
          }))}
        />
        <ApartmentNotesForm
          apartmentId={apartment.id}
          revision={apartment.revision}
          notes={apartment.notes}
          saved={resolvedSearchParams.notes_saved === "1"}
        />
        <ApartmentDescriptionForm
          apartmentId={apartment.id}
          revision={apartment.revision}
          description={apartment.description}
          saved={resolvedSearchParams.description_saved === "1"}
        />
        <ApartmentDocuments
          apartmentId={apartment.id}
          documents={apartment.documents.map((d) => ({
            id: d.id,
            fileName: d.fileName,
            url: d.url,
          }))}
        />
        <ViewingAppointments
          apartmentId={apartment.id}
          scheduleWarnings={scheduleWarnings}
          viewings={apartment.viewings.map((v) => ({
            id: v.id,
            scheduledAt: v.scheduledAt.toISOString(),
            note: v.note,
          }))}
        />
        <PartnerDivergencePanel comparisons={divergenceComparisons} />
        {extraEntries.some((e) => hasChecklistInfo(e)) && (
          <CollapsibleSection title="Checkliste · Zusatzpunkte" defaultOpen={false}>
            <ApartmentChecklistExtras
              entries={extraEntries}
              checklistHref={checklistEditHref}
            />
          </CollapsibleSection>
        )}
        <CollapsibleSection title="Kriterien bewerten" defaultOpen={false}>
          <RatingSliders
            apartmentId={apartment.id}
            groups={groupsWithRatings}
            partners={partners}
            criteriaFlat={criteria}
            myUserId={user.id}
            dealbreakerThreshold={dealbreakerThreshold}
            checklistByCriterionId={checklistByCriterionId}
            checklistEditHref={checklistEditHref}
          />
        </CollapsibleSection>
        </ApartmentScoreProvider>
        </div>
        </ApartmentUnsavedGuard>
      </main>
      <Footer />
    </>
  );
}
