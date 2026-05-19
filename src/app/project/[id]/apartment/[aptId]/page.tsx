import dynamic from "next/dynamic";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { ScoreBadge } from "@/components/ScoreBadge";
import { ApartmentDocuments } from "@/components/ApartmentDocuments";
import { RatingSliders } from "@/components/RatingSliders";
import { ViewingAppointments } from "@/components/ViewingAppointments";
import { formatDateDe } from "@/lib/dates";
import { getSessionUser, isAdmin } from "@/lib/auth";
import { ApartmentBasicsForm } from "@/components/ApartmentBasicsForm";
import { ApartmentArchiveButton } from "@/components/ApartmentArchiveButton";
import { ApartmentDeleteButton } from "@/components/ApartmentDeleteButton";
import { ApartmentDescriptionForm } from "@/components/ApartmentDescriptionForm";
import { ApartmentListingUrlForm } from "@/components/ApartmentListingUrlForm";
import { ApartmentNotesForm } from "@/components/ApartmentNotesForm";
import { ApartmentPurchaseCosts } from "@/components/ApartmentPurchaseCosts";
import { ApartmentCommutePanel } from "@/components/ApartmentCommutePanel";
import { computeCommuteLegs } from "@/lib/commute";
import { prisma } from "@/lib/prisma";
import { parseTravelMode } from "@/lib/travel-mode";
import {
  apartmentScore,
  flattenCriteria,
  getApartmentForUser,
  getProjectMetaForUser,
} from "@/lib/project-data";
import { ScoreLegend } from "@/components/ScoreLegend";
import { resolveDealbreakerThreshold } from "@/lib/scoring";

const ApartmentPhotos = dynamic(() => import("@/components/ApartmentPhotos"));

export default async function ApartmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; aptId: string }>;
  searchParams: Promise<{
    listing_saved?: string;
    listing_error?: string;
    notes_saved?: string;
    description_saved?: string;
    basics_saved?: string;
  }>;
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (isAdmin(user)) redirect("/admin");

  const project = await getProjectMetaForUser(resolvedParams.id, user.id);
  if (!project) redirect("/dashboard");

  const apartment = await getApartmentForUser(resolvedParams.id, resolvedParams.aptId, user.id);
  if (!apartment) redirect(`/project/${project.id}`);

  const criteria = flattenCriteria(project.groups);
  const dealbreakerThreshold = resolveDealbreakerThreshold(project.dealbreakerThreshold);
  const myScore = apartmentScore(criteria, apartment.ratings, user.id, dealbreakerThreshold);
  const archived = apartment.archivedAt != null;

  const groupsWithRatings = project.groups.map((g) => ({
    id: g.id,
    name: g.name,
    criteria: g.criteria.map((c) => ({
      ...c,
      rating: apartment.ratings.find((r) => r.criterionId === c.id && r.userId === user.id),
    })),
  }));

  const profile = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    include: {
      addresses: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
    },
  });
  const travelMode = parseTravelMode(profile.travelMode);
  const commuteLegs = await computeCommuteLegs({
    apartment:
      apartment.latitude != null && apartment.longitude != null
        ? { latitude: apartment.latitude, longitude: apartment.longitude }
        : null,
    addresses: profile.addresses.map((a) => ({
      id: a.id,
      label: a.label,
      address: a.address,
      latitude: a.latitude,
      longitude: a.longitude,
    })),
    travelMode,
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
        dealbreaker: result.dealbreaker,
        rated: result.rated,
      };
    });

  return (
    <>
      <Nav userName={user.name} />
      <main className="max-w-4xl mx-auto px-4 py-8 flex-1">
        <Link
          href={archived ? `/project/${project.id}?tab=archived` : `/project/${project.id}`}
          className="text-sm text-pn-accent hover:underline mb-4 inline-block"
        >
          ← Zurück zu {project.name}
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold">{apartment.title}</h1>
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
          </div>
          <div className="flex items-center gap-3">
            <ApartmentArchiveButton apartmentId={apartment.id} archived={archived} />
            <ApartmentDeleteButton apartmentId={apartment.id} />
            <ScoreBadge score={myScore.score} dealbreaker={myScore.dealbreaker} />
          </div>
        </div>
        <p className="text-sm text-pn-text-secondary mb-2">
          {myScore.rated}/{myScore.total} Kriterien bewertet · angemeldet als {user.name}
          {apartment.viewedAt && ` · zuletzt besichtigt: ${formatDateDe(apartment.viewedAt)}`}
        </p>
        <ScoreLegend className="mb-6" />
        <ApartmentBasicsForm
          apartmentId={apartment.id}
          address={apartment.address}
          price={apartment.price}
          budget={project.budget}
          saved={resolvedSearchParams.basics_saved === "1"}
        />
        <ApartmentCommutePanel
          legs={commuteLegs}
          travelMode={travelMode}
          settingsHref="/account/settings"
        />
        <ApartmentPurchaseCosts
          apartmentId={apartment.id}
          price={apartment.price}
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
        <ApartmentListingUrlForm
          apartmentId={apartment.id}
          listingUrl={apartment.listingUrl}
          saved={resolvedSearchParams.listing_saved === "1"}
          invalid={resolvedSearchParams.listing_error === "invalid"}
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
        <h2 className="text-lg font-semibold mb-4">Kriterien bewerten</h2>
        <RatingSliders
          apartmentId={apartment.id}
          groups={groupsWithRatings}
          partners={partners}
          criteriaFlat={criteria}
          myUserId={user.id}
          dealbreakerThreshold={dealbreakerThreshold}
        />
      </main>
      <Footer />
    </>
  );
}
