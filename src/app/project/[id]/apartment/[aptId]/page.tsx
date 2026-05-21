import dynamic from "next/dynamic";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { ApartmentLiveScoreBadge } from "@/components/ApartmentLiveScoreBadge";
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
import { isPdfDocument } from "@/lib/pdf-reindex";
import { isLlmConfigured } from "@/lib/llm-client";
import { ApartmentLlmChatButton } from "@/components/ApartmentLlmChatButton";
import { ApartmentLlmExtractButton } from "@/components/ApartmentLlmExtractButton";

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
    address_unresolved?: string;
    address_geocoded?: string;
    address_geocode_failed?: string;
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
    floor: apartment.floor,
    yearBuilt: apartment.yearBuilt,
    energyClass: apartment.energyClass,
    brokerInvolved: apartment.brokerInvolved,
    description: apartment.description,
    notes: apartment.notes,
    documents: apartment.documents.map((d) => ({
      fileName: d.fileName,
      extractedText: d.extractedText,
    })),
  };
  const llmHasSourceText = apartmentLlmHasSourceText(llmContext);
  const hasPdfDocument = apartment.documents.some((d) =>
    isPdfDocument(d.mimeType, d.url)
  );

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

  return (
    <>
      <Nav userName={user.name} isAdmin={admin} />
      <main className="max-w-4xl mx-auto px-4 py-6 sm:py-8 flex-1 min-w-0 w-full">
        <ApartmentScoreProvider initial={myScore}>
        <Link
          href={archived ? `/project/${project.id}?tab=archived` : `/project/${project.id}`}
          className="text-sm text-pn-accent hover:underline mb-4 inline-block"
        >
          ← Zurück zu {project.name}
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <ApartmentTitleForm
              apartmentId={apartment.id}
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
              <a href={apartment.listingUrl} target="_blank" rel="noreferrer" className="text-sm text-pn-accent hover:underline mt-2 inline-block">
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
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {llmEnabled && (
              <ApartmentLlmChatButton
                apartmentId={apartment.id}
                hasSourceText={llmHasSourceText}
              />
            )}
            <ApartmentArchiveButton apartmentId={apartment.id} archived={archived} />
            <ApartmentDeleteButton apartmentId={apartment.id} />
            <ApartmentLiveScoreBadge />
          </div>
        </div>
        <ApartmentLiveScoreSummary userName={user.name} viewedAt={apartment.viewedAt} />
        <ScoreLegend className="mb-6" />
        <ApartmentBasicsForm
          projectId={project.id}
          apartmentId={apartment.id}
          address={apartment.address}
          latitude={apartment.latitude}
          longitude={apartment.longitude}
          price={apartment.price}
          priceHistoryCount={priceHistoryCount}
          timeZone={appTimeZone}
          sizeSqm={apartment.sizeSqm}
          energyClass={apartment.energyClass}
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
          listingUrl={apartment.listingUrl}
          saved={resolvedSearchParams.listing_saved === "1"}
          invalid={resolvedSearchParams.listing_error === "invalid"}
          llmExtractSlot={
            llmEnabled ? (
              <ApartmentLlmExtractButton
                apartmentId={apartment.id}
                hasPdfText={hasPdfDocument}
                hasListingUrl={Boolean(apartment.listingUrl?.trim())}
              />
            ) : undefined
          }
        />
        <ApartmentCommutePanel
          people={commutePeople}
          settingsHref="/account/settings"
          viewerIsAdmin={admin}
        />
        <ApartmentPurchaseCosts
          apartmentId={apartment.id}
          price={apartment.price}
          address={apartment.address}
          federalStateCode={project.federalStateCode}
          brokerBuyerRate={project.brokerBuyerRate}
          brokerInvolved={apartment.brokerInvolved}
          equityAmount={project.equityAmount}
          loanTermYears={project.loanTermYears}
          interestRate={project.interestRate}
          netHouseholdIncome={project.netHouseholdIncome}
          settingsHref={`/project/${project.id}?tab=settings`}
        />
        <ApartmentPhotos
          apartmentId={apartment.id}
          photos={apartment.photos.map((p) => ({
            id: p.id,
            url: p.url,
            caption: p.caption,
          }))}
        />
        <ApartmentNotesForm
          apartmentId={apartment.id}
          notes={apartment.notes}
          saved={resolvedSearchParams.notes_saved === "1"}
        />
        <ApartmentDescriptionForm
          apartmentId={apartment.id}
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
          viewings={apartment.viewings.map((v) => ({
            id: v.id,
            scheduledAt: v.scheduledAt.toISOString(),
            note: v.note,
          }))}
        />
        <PartnerDivergencePanel comparisons={divergenceComparisons} />
        <CollapsibleSection title="Kriterien bewerten" defaultOpen>
          <RatingSliders
            apartmentId={apartment.id}
            groups={groupsWithRatings}
            partners={partners}
            criteriaFlat={criteria}
            myUserId={user.id}
            dealbreakerThreshold={dealbreakerThreshold}
          />
        </CollapsibleSection>
        </ApartmentScoreProvider>
      </main>
      <Footer />
    </>
  );
}
