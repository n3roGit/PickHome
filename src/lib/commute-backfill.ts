import { beginBackgroundTask, endBackgroundTask, backgroundThrottlePause } from "@/lib/background-task";
import { computeCommuteLegs } from "@/lib/commute";
import type { ExternalService } from "@/lib/external-fetch";
import { isExternalServiceInCooldown } from "@/lib/external-fetch";
import { isCommuteReindexRunning } from "@/lib/project-reindex-jobs";
import { prisma } from "@/lib/prisma";
import { parseCompanyCarCommuteMethod, parseCompanyCarRate } from "@/lib/company-car";
import { resolveTransitSettings } from "@/lib/transit-settings";
import { parseTravelMode, type TravelMode } from "@/lib/travel-mode";

export const COMMUTE_BACKFILL_MAX_LEGS_PER_TICK = 6;

type MissingCommuteLegRow = {
  apartmentId: string;
  projectId: string;
  userId: string;
  userAddressId: string;
  travelMode: string;
};

export type CommuteBackfillTickResult = {
  attempted: number;
  computed: number;
  skipped: number;
  stoppedEarly: boolean;
};

function externalServiceForTravelMode(travelMode: TravelMode): ExternalService {
  return travelMode === "transit" ? "transit" : "osrm";
}

export async function countMissingCommuteLegsForProject(projectId: string): Promise<number> {
  const rows = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*) AS count
    FROM Apartment a
    INNER JOIN Project p ON p.id = a.projectId AND p.archivedAt IS NULL
    INNER JOIN ProjectMember pm ON pm.projectId = a.projectId
    INNER JOIN User u ON u.id = pm.userId
    INNER JOIN UserAddress ua ON ua.userId = u.id
    LEFT JOIN CommuteCache cc ON
      cc.apartmentId = a.id AND
      cc.userAddressId = ua.id AND
      cc.travelMode = u.travelMode
    WHERE
      a.projectId = ${projectId} AND
      a.archivedAt IS NULL AND
      a.latitude IS NOT NULL AND
      a.longitude IS NOT NULL AND
      ua.latitude IS NOT NULL AND
      ua.longitude IS NOT NULL AND
      cc.apartmentId IS NULL
  `;
  return Number(rows[0]?.count ?? 0);
}

export async function findMissingCommuteLegs(limit: number): Promise<MissingCommuteLegRow[]> {
  if (limit <= 0) return [];

  return prisma.$queryRaw<MissingCommuteLegRow[]>`
    SELECT
      a.id AS apartmentId,
      a.projectId AS projectId,
      u.id AS userId,
      ua.id AS userAddressId,
      u.travelMode AS travelMode
    FROM Apartment a
    INNER JOIN Project p ON p.id = a.projectId AND p.archivedAt IS NULL
    INNER JOIN ProjectMember pm ON pm.projectId = a.projectId
    INNER JOIN User u ON u.id = pm.userId
    INNER JOIN UserAddress ua ON ua.userId = u.id
    LEFT JOIN CommuteCache cc ON
      cc.apartmentId = a.id AND
      cc.userAddressId = ua.id AND
      cc.travelMode = u.travelMode
    WHERE
      a.archivedAt IS NULL AND
      a.latitude IS NOT NULL AND
      a.longitude IS NOT NULL AND
      ua.latitude IS NOT NULL AND
      ua.longitude IS NOT NULL AND
      cc.apartmentId IS NULL
    ORDER BY a.createdAt ASC, ua.sortOrder ASC, ua.createdAt ASC
    LIMIT ${limit}
  `;
}

export async function runCommuteBackfillTick(
  maxLegs = COMMUTE_BACKFILL_MAX_LEGS_PER_TICK
): Promise<CommuteBackfillTickResult> {
  if (process.env.PICKHOME_COMMUTE_BACKFILL === "0") {
    return { attempted: 0, computed: 0, skipped: 0, stoppedEarly: false };
  }

  const missing = await findMissingCommuteLegs(maxLegs);
  if (missing.length === 0) {
    return { attempted: 0, computed: 0, skipped: 0, stoppedEarly: false };
  }

  beginBackgroundTask();
  let attempted = 0;
  let computed = 0;
  let skipped = 0;
  let stoppedEarly = false;

  try {
    for (const row of missing) {
      const travelMode = parseTravelMode(row.travelMode);
      const service = externalServiceForTravelMode(travelMode);
      if (isExternalServiceInCooldown(service)) {
        stoppedEarly = true;
        break;
      }

      if (await isCommuteReindexRunning(row.projectId)) {
        skipped += 1;
        continue;
      }

      const [apartment, user] = await Promise.all([
        prisma.apartment.findUnique({
          where: { id: row.apartmentId },
          select: {
            id: true,
            latitude: true,
            longitude: true,
            address: true,
            title: true,
          },
        }),
        prisma.user.findUnique({
          where: { id: row.userId },
          select: {
            travelMode: true,
            companyCar: true,
            companyCarRate: true,
            listPrice: true,
            marginalTaxRatePercent: true,
            companyCarCommuteMethod: true,
            companyCarOfficeTripsPerMonth: true,
            companyCarContributionEur: true,
            companyCarSelfPaidCostsEur: true,
            companyCarEmployerFuelCard: true,
            transitArrivalHour: true,
            transitArrivalMinute: true,
            transitArrivalWeekday: true,
            transitFallbackMaxKm: true,
            transitFallbackMode: true,
            addresses: {
              where: { id: row.userAddressId },
              take: 1,
            },
          },
        }),
      ]);

      const addr = user?.addresses[0];
      if (
        !apartment ||
        apartment.latitude == null ||
        apartment.longitude == null ||
        !user ||
        !addr ||
        addr.latitude == null ||
        addr.longitude == null
      ) {
        skipped += 1;
        continue;
      }

      const memberTravelMode = parseTravelMode(user.travelMode);
      attempted += 1;

      const legs = await computeCommuteLegs({
        apartmentId: apartment.id,
        apartment: { latitude: apartment.latitude, longitude: apartment.longitude },
        apartmentAddress: apartment.address ?? apartment.title,
        addresses: [
          {
            id: addr.id,
            label: addr.label,
            address: addr.address,
            latitude: addr.latitude,
            longitude: addr.longitude,
            isWorkplace: addr.isWorkplace,
          },
        ],
        travelMode: memberTravelMode,
        transitSettings:
          memberTravelMode === "transit" ? resolveTransitSettings(user) : null,
        companyCar: user.companyCar,
        companyCarRate: user.companyCar ? parseCompanyCarRate(user.companyCarRate) : null,
        listPrice: user.listPrice,
        marginalTaxRatePercent: user.marginalTaxRatePercent,
        companyCarCommuteMethod: user.companyCar
          ? parseCompanyCarCommuteMethod(user.companyCarCommuteMethod)
          : null,
        companyCarOfficeTripsPerMonth: user.companyCar
          ? user.companyCarOfficeTripsPerMonth
          : null,
        companyCarContributionEur: user.companyCar ? user.companyCarContributionEur : null,
        companyCarSelfPaidCostsEur: user.companyCar ? user.companyCarSelfPaidCostsEur : null,
        companyCarEmployerFuelCard: user.companyCar ? user.companyCarEmployerFuelCard : true,
        background: true,
      });

      const leg = legs[0];
      if (!leg?.unavailableReason) {
        computed += 1;
      } else if (leg.unavailableReason === "api_unavailable") {
        stoppedEarly = true;
        break;
      } else {
        skipped += 1;
      }

      await backgroundThrottlePause(300);
    }
  } finally {
    endBackgroundTask();
  }

  return { attempted, computed, skipped, stoppedEarly };
}
