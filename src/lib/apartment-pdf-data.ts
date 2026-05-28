import { getAppTimeZone } from "@/lib/app-settings";
import { getApartmentPriceHistory } from "@/lib/apartment-price-history";
import { getOrFetchBorisForApartment } from "@/lib/boris-cache";
import { computeCommuteForMembers, type CommutePersonEstimate } from "@/lib/commute";
import { parseCompanyCarCommuteMethod, parseCompanyCarRate } from "@/lib/company-car";
import {
  estimatePurchaseCosts,
  resolveFederalStateCode,
  totalAcquisitionCost,
  type PurchaseCostEstimate,
} from "@/lib/purchase-costs";
import { assertApartmentAccess, apartmentScore, flattenCriteria } from "@/lib/project-data";
import type { ProjectAccessUser } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";
import { resolveDealbreakerThreshold } from "@/lib/scoring";
import { resolveTransitSettings } from "@/lib/transit-settings";
import { parseTravelMode } from "@/lib/travel-mode";

export type ApartmentPdfVariant = "full" | "bank";

export type ApartmentPdfRatingRow = {
  criterionId: string;
  name: string;
  isDealbreaker: boolean;
  score: number | null;
  note: string | null;
};

export type ApartmentPdfRatingGroup = {
  groupName: string;
  criteria: ApartmentPdfRatingRow[];
};

export type ApartmentPdfPriceHistoryRow = {
  recordedAt: Date;
  price: number;
  previousPrice: number | null;
  sourceLabel: string;
};

export type ApartmentPdfViewingRow = {
  scheduledAt: Date;
  note: string | null;
};

export type ApartmentPdfBorisRow = {
  kategorieLabel: string;
  brwEurPerSqm: number;
  nutzungsartLabel: string | null;
  stichtag: string | null;
};

export type ApartmentPdfData = {
  exportedAt: Date;
  timeZone: string;
  projectName: string;
  userName: string;
  score: {
    displayScore: number;
    dealbreaker: boolean;
    rated: number;
    total: number;
  };
  apartment: {
    title: string;
    address: string | null;
    listingUrl: string | null;
    price: number | null;
    sizeSqm: number | null;
    plotSizeSqm: number | null;
    floor: number | null;
    yearBuilt: number | null;
    energyClass: string | null;
    brokerInvolved: boolean;
    hoaFeeMonthly: number | null;
    heatingCostMonthly: number | null;
    propertyTaxAnnual: number | null;
    renovationCost: number | null;
    coldRentMonthly: number | null;
    description: string | null;
    notes: string | null;
    viewedAt: Date | null;
    archivedAt: Date | null;
  };
  purchaseCosts: PurchaseCostEstimate | null;
  acquisitionTotal: number | null;
  finance: {
    equityAmount: number | null;
    loanTermYears: number | null;
    interestRate: number | null;
    netHouseholdIncome: number | null;
    monthlyFixedCosts: number | null;
  };
  ratingGroups: ApartmentPdfRatingGroup[];
  commutePeople: CommutePersonEstimate[];
  viewings: ApartmentPdfViewingRow[];
  priceHistory: ApartmentPdfPriceHistoryRow[];
  boris: {
    status: "ok" | "no_coords" | "no_data" | "error";
    fetchedAt: Date;
    errorMessage: string | null;
    results: ApartmentPdfBorisRow[];
  };
};

export function apartmentPdfFilename(
  title: string,
  variant: ApartmentPdfVariant = "full"
): string {
  const base = title.trim() || "immobilie";
  const safe = base
    .replace(/[^\p{L}\p{N}\-_ ]+/gu, "")
    .replace(/\s+/g, "-")
    .slice(0, 80);
  const suffix = variant === "bank" ? "-bankberater" : "";
  return `${safe || "immobilie"}${suffix}.pdf`;
}

export async function loadApartmentPdfData(
  apartmentId: string,
  user: ProjectAccessUser
): Promise<ApartmentPdfData | null> {
  const access = await assertApartmentAccess(apartmentId, user);
  if (!access) return null;

  const [row, timeZone, priceHistoryRows, borisSnapshot] = await Promise.all([
    prisma.apartment.findUnique({
      where: { id: apartmentId },
      include: {
        project: {
          select: {
            name: true,
            dealbreakerThreshold: true,
            federalStateCode: true,
            brokerBuyerRate: true,
            equityAmount: true,
            loanTermYears: true,
            interestRate: true,
            netHouseholdIncome: true,
            monthlyFixedCosts: true,
            members: { select: { userId: true } },
            groups: {
              orderBy: { sortOrder: "asc" },
              include: {
                criteria: { orderBy: { sortOrder: "asc" } },
              },
            },
          },
        },
        ratings: {
          where: { userId: user.id },
          select: {
            criterionId: true,
            userId: true,
            score: true,
            note: true,
          },
        },
        viewings: {
          orderBy: { scheduledAt: "desc" },
          select: {
            scheduledAt: true,
            note: true,
          },
        },
      },
    }),
    getAppTimeZone(),
    getApartmentPriceHistory(apartmentId),
    getOrFetchBorisForApartment(prisma, apartmentId),
  ]);

  if (!row) return null;

  const userRow = await prisma.user.findUnique({
    where: { id: user.id },
    select: { name: true },
  });

  const ratingByCriterionId = new Map(
    row.ratings.map((rating) => [rating.criterionId, rating])
  );

  const ratingGroups: ApartmentPdfRatingGroup[] = row.project.groups.map((group) => ({
    groupName: group.name,
    criteria: group.criteria.map((criterion) => {
      const rating = ratingByCriterionId.get(criterion.id);
      return {
        criterionId: criterion.id,
        name: criterion.name,
        isDealbreaker: criterion.isDealbreaker,
        score: rating?.score ?? null,
        note: rating?.note ?? null,
      };
    }),
  }));

  const criteria = flattenCriteria(row.project.groups);
  const dealbreakerThreshold = resolveDealbreakerThreshold(row.project.dealbreakerThreshold);
  const score = apartmentScore(criteria, row.ratings, user.id, dealbreakerThreshold);

  const federalStateCode = resolveFederalStateCode({
    projectFederalStateCode: row.project.federalStateCode,
    apartmentAddress: row.address,
  });

  const purchaseCosts =
    row.price != null && federalStateCode
      ? estimatePurchaseCosts({
          price: row.price,
          federalStateCode,
          brokerInvolved: row.brokerInvolved,
          brokerBuyerRate: row.project.brokerBuyerRate,
        })
      : null;

  const acquisitionTotal = purchaseCosts
    ? totalAcquisitionCost(purchaseCosts, row.renovationCost)
    : null;

  const memberUsers = await prisma.user.findMany({
    where: { id: { in: row.project.members.map((member) => member.userId) } },
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
    row.latitude != null && row.longitude != null
      ? { latitude: row.latitude, longitude: row.longitude }
      : null;

  const commutePeople = await computeCommuteForMembers({
    apartmentId: row.id,
    apartment: apartmentCoords,
    apartmentAddress: row.address ?? row.title,
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
      companyCarOfficeTripsPerMonth: member.companyCar
        ? member.companyCarOfficeTripsPerMonth
        : null,
      companyCarContributionEur: member.companyCar ? member.companyCarContributionEur : null,
      companyCarSelfPaidCostsEur: member.companyCar ? member.companyCarSelfPaidCostsEur : null,
      companyCarEmployerFuelCard: member.companyCar ? member.companyCarEmployerFuelCard : true,
      commuteAllowanceDaysPerYear: member.commuteAllowanceDaysPerYear,
      commuteAllowanceVacationDays: member.commuteAllowanceVacationDays,
      commuteAllowanceSickDays: member.commuteAllowanceSickDays,
      commuteAllowanceHomeOfficeDays: member.commuteAllowanceHomeOfficeDays,
      addresses: member.addresses.map((address) => ({
        id: address.id,
        label: address.label,
        address: address.address,
        latitude: address.latitude,
        longitude: address.longitude,
        isWorkplace: address.isWorkplace,
      })),
    })),
  });

  const { priceHistorySourceLabelDe } = await import("@/lib/apartment-price-history-labels");

  return {
    exportedAt: new Date(),
    timeZone,
    projectName: row.project.name,
    userName: userRow?.name ?? "Unbekannt",
    score: {
      displayScore: score.displayScore,
      dealbreaker: score.dealbreaker,
      rated: score.rated,
      total: score.total,
    },
    apartment: {
      title: row.title,
      address: row.address,
      listingUrl: row.listingUrl,
      price: row.price,
      sizeSqm: row.sizeSqm,
      plotSizeSqm: row.plotSizeSqm,
      floor: row.floor,
      yearBuilt: row.yearBuilt,
      energyClass: row.energyClass,
      brokerInvolved: row.brokerInvolved,
      hoaFeeMonthly: row.hoaFeeMonthly,
      heatingCostMonthly: row.heatingCostMonthly,
      propertyTaxAnnual: row.propertyTaxAnnual,
      renovationCost: row.renovationCost,
      coldRentMonthly: row.coldRentMonthly,
      description: row.description,
      notes: row.notes,
      viewedAt: row.viewedAt,
      archivedAt: row.archivedAt,
    },
    purchaseCosts,
    acquisitionTotal,
    finance: {
      equityAmount: row.project.equityAmount,
      loanTermYears: row.project.loanTermYears,
      interestRate: row.project.interestRate,
      netHouseholdIncome: row.project.netHouseholdIncome,
      monthlyFixedCosts: row.project.monthlyFixedCosts,
    },
    ratingGroups,
    commutePeople,
    viewings: row.viewings,
    priceHistory: priceHistoryRows.map((entry) => ({
      recordedAt: entry.recordedAt,
      price: entry.price,
      previousPrice: entry.previousPrice,
      sourceLabel: priceHistorySourceLabelDe(entry.source),
    })),
    boris: {
      status: borisSnapshot.status,
      fetchedAt: borisSnapshot.fetchedAt,
      errorMessage: borisSnapshot.errorMessage,
      results: borisSnapshot.results.map((result) => ({
        kategorieLabel: result.kategorieLabel,
        brwEurPerSqm: result.brwEurPerSqm,
        nutzungsartLabel: result.nutzungsartLabel,
        stichtag: result.stichtag,
      })),
    },
  };
}
