import { backgroundThrottlePause } from "@/lib/background-task";
import { computeCommuteLegs, type CommuteLeg } from "@/lib/commute";
import { invalidateCommuteCacheForProject } from "@/lib/commute-cache";
import { prisma } from "@/lib/prisma";
import type { RoutePoint } from "@/lib/routing";
import { resolveTransitSettings } from "@/lib/transit-settings";
import { parseTravelMode } from "@/lib/travel-mode";
import { parseCompanyCarCommuteMethod, parseCompanyCarRate } from "@/lib/company-car";

export type ReindexProjectCommuteResult = {
  apartmentsTotal: number;
  apartmentsWithCoords: number;
  routesComputed: number;
  routesSkipped: number;
  routesFailed: number;
  routesApiUnavailable: number;
};

function countLegOutcome(leg: CommuteLeg): "computed" | "skipped" | "failed" | "api_unavailable" {
  if (!leg.unavailableReason) return "computed";
  if (leg.unavailableReason === "api_unavailable") return "api_unavailable";
  if (leg.unavailableReason === "routing_failed") return "failed";
  return "skipped";
}

export async function reindexProjectCommute(projectId: string): Promise<ReindexProjectCommuteResult> {
  await invalidateCommuteCacheForProject(projectId);

  const [apartments, members] = await Promise.all([
    prisma.apartment.findMany({
      where: { projectId, archivedAt: null },
      select: { id: true, latitude: true, longitude: true, address: true, title: true },
    }),
    prisma.projectMember.findMany({
      where: { projectId },
      select: {
        user: {
          select: {
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
        },
      },
    }),
  ]);

  const memberInputs = members.map((m) => {
    const travelMode = parseTravelMode(m.user.travelMode);
    return {
    travelMode,
    transitSettings: travelMode === "transit" ? resolveTransitSettings(m.user) : null,
    companyCar: m.user.companyCar,
    companyCarRate: m.user.companyCar ? parseCompanyCarRate(m.user.companyCarRate) : null,
    listPrice: m.user.listPrice,
    marginalTaxRatePercent: m.user.marginalTaxRatePercent,
    companyCarCommuteMethod: m.user.companyCar
      ? parseCompanyCarCommuteMethod(m.user.companyCarCommuteMethod)
      : null,
    companyCarOfficeTripsPerMonth: m.user.companyCar ? m.user.companyCarOfficeTripsPerMonth : null,
    companyCarContributionEur: m.user.companyCar ? m.user.companyCarContributionEur : null,
    companyCarSelfPaidCostsEur: m.user.companyCar ? m.user.companyCarSelfPaidCostsEur : null,
    companyCarEmployerFuelCard: m.user.companyCar ? m.user.companyCarEmployerFuelCard : true,
    commuteAllowanceDaysPerYear: m.user.commuteAllowanceDaysPerYear,
    commuteAllowanceVacationDays: m.user.commuteAllowanceVacationDays,
    commuteAllowanceSickDays: m.user.commuteAllowanceSickDays,
    commuteAllowanceHomeOfficeDays: m.user.commuteAllowanceHomeOfficeDays,
    addresses: m.user.addresses.map((a) => ({
      id: a.id,
      label: a.label,
      address: a.address,
      latitude: a.latitude,
      longitude: a.longitude,
      isWorkplace: a.isWorkplace,
    })),
  };
  });

  let routesComputed = 0;
  let routesSkipped = 0;
  let routesFailed = 0;
  let routesApiUnavailable = 0;
  let apartmentsWithCoords = 0;

  for (const apt of apartments) {
    const apartment: RoutePoint | null =
      apt.latitude != null && apt.longitude != null
        ? { latitude: apt.latitude, longitude: apt.longitude }
        : null;

    if (!apartment) {
      for (const member of memberInputs) {
        for (const _addr of member.addresses) {
          routesSkipped += 1;
        }
      }
      continue;
    }

    apartmentsWithCoords += 1;

    for (const member of memberInputs) {
      if (member.addresses.length === 0) continue;

      const legs = await computeCommuteLegs({
        apartmentId: apt.id,
        apartment,
        apartmentAddress: apt.address ?? apt.title,
        addresses: member.addresses,
        travelMode: member.travelMode,
        transitSettings: member.transitSettings,
        companyCar: member.companyCar,
        companyCarRate: member.companyCarRate,
        listPrice: member.listPrice,
        marginalTaxRatePercent: member.marginalTaxRatePercent,
        companyCarCommuteMethod: member.companyCarCommuteMethod,
        companyCarOfficeTripsPerMonth: member.companyCarOfficeTripsPerMonth,
        companyCarContributionEur: member.companyCarContributionEur,
        companyCarSelfPaidCostsEur: member.companyCarSelfPaidCostsEur,
        companyCarEmployerFuelCard: member.companyCarEmployerFuelCard,
        commuteAllowanceDaysPerYear: member.commuteAllowanceDaysPerYear,
        commuteAllowanceVacationDays: member.commuteAllowanceVacationDays,
        commuteAllowanceSickDays: member.commuteAllowanceSickDays,
        commuteAllowanceHomeOfficeDays: member.commuteAllowanceHomeOfficeDays,
        background: true,
      });

      let hadApiUnavailable = false;
      for (const leg of legs) {
        const outcome = countLegOutcome(leg);
        if (outcome === "computed") routesComputed += 1;
        else if (outcome === "failed") routesFailed += 1;
        else if (outcome === "api_unavailable") {
          routesApiUnavailable += 1;
          hadApiUnavailable = true;
        } else routesSkipped += 1;
      }

      await backgroundThrottlePause(hadApiUnavailable ? 1000 : 250);
    }

    await backgroundThrottlePause(150);
  }

  return {
    apartmentsTotal: apartments.length,
    apartmentsWithCoords,
    routesComputed,
    routesSkipped,
    routesFailed,
    routesApiUnavailable,
  };
}
