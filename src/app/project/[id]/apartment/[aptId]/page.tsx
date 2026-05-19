import Link from "next/link";
import { redirect } from "next/navigation";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { ScoreBadge } from "@/components/ScoreBadge";
import { ApartmentPhotos } from "@/components/ApartmentPhotos";
import { ApartmentDocuments } from "@/components/ApartmentDocuments";
import { RatingSliders } from "@/components/RatingSliders";
import { ViewingAppointments } from "@/components/ViewingAppointments";
import { formatDateDe } from "@/lib/dates";
import { getSessionUser, isAdmin } from "@/lib/auth";
import { ApartmentArchiveButton } from "@/components/ApartmentArchiveButton";
import { ApartmentListingUrlForm } from "@/components/ApartmentListingUrlForm";
import { ApartmentPurchaseCosts } from "@/components/ApartmentPurchaseCosts";
import {
  apartmentScore,
  flattenCriteria,
  getApartmentForUser,
  getProjectMetaForUser,
} from "@/lib/project-data";
import { ScoreLegend } from "@/components/ScoreLegend";
import { formatBudgetHint, formatPrice } from "@/lib/scoring";

export default async function ApartmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; aptId: string }>;
  searchParams: Promise<{ listing_saved?: string; listing_error?: string }>;
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
  const myScore = apartmentScore(criteria, apartment.ratings, user.id);
  const archived = apartment.archivedAt != null;

  const groupsWithRatings = project.groups.map((g) => ({
    id: g.id,
    name: g.name,
    criteria: g.criteria.map((c) => ({
      ...c,
      rating: apartment.ratings.find((r) => r.criterionId === c.id && r.userId === user.id),
    })),
  }));

  const partners = project.members
    .filter((m) => m.userId !== user.id)
    .map((m) => {
      const partnerRatings = apartment.ratings.filter((r) => r.userId === m.userId);
      const result = apartmentScore(criteria, partnerRatings, m.userId);
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
            {apartment.address && <p className="text-pn-text-secondary">{apartment.address}</p>}
            {apartment.price != null && (
              <p className="text-lg font-semibold mt-1">
                {formatPrice(apartment.price)}
                {project.budget != null && (
                  <span
                    className={`block text-sm font-normal mt-0.5 ${
                      apartment.price > project.budget
                        ? "text-pn-score-low"
                        : apartment.price < project.budget
                          ? "text-pn-score-high"
                          : "text-pn-text-tertiary"
                    }`}
                  >
                    {formatBudgetHint(apartment.price, project.budget)}
                  </span>
                )}
              </p>
            )}
            {apartment.listingUrl && (
              <a href={apartment.listingUrl} target="_blank" rel="noreferrer" className="text-sm text-pn-accent hover:underline">
                Inserat öffnen ↗
              </a>
            )}
            {apartment.description && (
              <p className="text-sm text-pn-text-secondary mt-3 whitespace-pre-wrap">{apartment.description}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <ApartmentArchiveButton apartmentId={apartment.id} archived={archived} />
            <ScoreBadge score={myScore.score} dealbreaker={myScore.dealbreaker} />
          </div>
        </div>
        <p className="text-sm text-pn-text-secondary mb-2">
          {myScore.rated}/{myScore.total} Kriterien bewertet · angemeldet als {user.name}
          {apartment.viewedAt && ` · zuletzt besichtigt: ${formatDateDe(apartment.viewedAt)}`}
        </p>
        <ScoreLegend className="mb-6" />
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
        />
      </main>
      <Footer />
    </>
  );
}
