import { beginBackgroundTask, endBackgroundTask } from "@/lib/background-task";
import {
  applyApartmentPriceUpdate,
  PRICE_HISTORY_SOURCE_LISTING_SYNC,
} from "@/lib/apartment-price-history";
import { getAppTimeZone } from "@/lib/app-settings";
import { fetchListingPriceFromUrl } from "@/lib/listing-import";
import { prisma } from "@/lib/prisma";
import { scheduledRunAtInTimeZone } from "@/lib/timezone";

export const LISTING_PRICE_SYNC_JOB_SETTINGS_ID = "default";
export const LISTING_PRICE_SYNC_MAX_PER_TICK = 8;

export function isListingPriceSyncDue(
  settings: { enabled: boolean; hour: number; minute: number; lastRunAt: Date | null },
  now = new Date(),
  timeZone: string
): boolean {
  if (!settings.enabled) return false;

  const scheduled = scheduledRunAtInTimeZone(now, settings.hour, settings.minute, timeZone);
  if (now < scheduled) return false;
  if (!settings.lastRunAt) return true;
  return settings.lastRunAt < scheduled;
}

export function listingPriceSyncCycleStart(
  settings: { hour: number; minute: number },
  now: Date,
  timeZone: string
): Date {
  return scheduledRunAtInTimeZone(now, settings.hour, settings.minute, timeZone);
}

export async function getOrCreateListingPriceSyncJobSettings() {
  return prisma.listingPriceSyncJobSettings.upsert({
    where: { id: LISTING_PRICE_SYNC_JOB_SETTINGS_ID },
    create: { id: LISTING_PRICE_SYNC_JOB_SETTINGS_ID },
    update: {},
  });
}

function apartmentsDueWhere(cycleStart: Date) {
  return {
    archivedAt: null,
    listingUrl: { not: null },
    OR: [{ listingPriceCheckedAt: null }, { listingPriceCheckedAt: { lt: cycleStart } }],
  } as const;
}

export async function countApartmentsDueForListingPriceCheck(
  settings: { hour: number; minute: number },
  now = new Date(),
  timeZone?: string
): Promise<number> {
  const tz = timeZone ?? (await getAppTimeZone());
  const cycleStart = listingPriceSyncCycleStart(settings, now, tz);
  return prisma.apartment.count({ where: apartmentsDueWhere(cycleStart) });
}

export async function findApartmentsDueForListingPriceCheck(
  limit: number,
  settings: { hour: number; minute: number },
  now = new Date(),
  timeZone?: string
) {
  if (limit <= 0) return [];

  const tz = timeZone ?? (await getAppTimeZone());
  const cycleStart = listingPriceSyncCycleStart(settings, now, tz);

  return prisma.apartment.findMany({
    where: apartmentsDueWhere(cycleStart),
    orderBy: [{ listingPriceCheckedAt: "asc" }, { createdAt: "asc" }],
    take: limit,
    select: { id: true, price: true, listingUrl: true, projectId: true },
  });
}

export type ListingPriceSyncTickResult = {
  checked: number;
  updated: number;
  failed: number;
  cycleComplete: boolean;
};

export async function syncListingPriceForApartment(apartment: {
  id: string;
  price: number | null;
  listingUrl: string | null;
}): Promise<"updated" | "unchanged" | "failed"> {
  if (!apartment.listingUrl) return "failed";

  const fetched = await fetchListingPriceFromUrl(apartment.listingUrl, { background: true });
  const now = new Date();

  if (!fetched.ok || fetched.price == null) {
    await prisma.apartment.update({
      where: { id: apartment.id },
      data: { listingPriceCheckedAt: now },
    });
    return "failed";
  }

  const listingPrice = fetched.price;
  if (apartment.price === listingPrice) {
    await prisma.apartment.update({
      where: { id: apartment.id },
      data: { listingPriceCheckedAt: now },
    });
    return "unchanged";
  }

  await applyApartmentPriceUpdate(apartment.id, listingPrice, PRICE_HISTORY_SOURCE_LISTING_SYNC);
  await prisma.apartment.update({
    where: { id: apartment.id },
    data: { listingPriceCheckedAt: now },
  });
  return "updated";
}

export async function runListingPriceSyncTick(): Promise<ListingPriceSyncTickResult> {
  const settings = await getOrCreateListingPriceSyncJobSettings();
  const timeZone = await getAppTimeZone();
  const now = new Date();
  const due = isListingPriceSyncDue(settings, now, timeZone);
  const pending = await countApartmentsDueForListingPriceCheck(settings, now, timeZone);

  if (pending === 0) {
    if (due) {
      await prisma.listingPriceSyncJobSettings.update({
        where: { id: LISTING_PRICE_SYNC_JOB_SETTINGS_ID },
        data: { lastRunAt: now },
      });
    }
    return { checked: 0, updated: 0, failed: 0, cycleComplete: true };
  }

  if (!due) {
    // Continue an incomplete daily cycle from a previous run.
  }

  beginBackgroundTask();
  try {
    const batch = await findApartmentsDueForListingPriceCheck(
      LISTING_PRICE_SYNC_MAX_PER_TICK,
      settings,
      now,
      timeZone
    );
    let updated = 0;
    let failed = 0;
    for (const apt of batch) {
      const result = await syncListingPriceForApartment(apt);
      if (result === "updated") updated += 1;
      else if (result === "failed") failed += 1;
    }

    const remaining = await countApartmentsDueForListingPriceCheck(settings, now, timeZone);
    if (remaining === 0) {
      await prisma.listingPriceSyncJobSettings.update({
        where: { id: LISTING_PRICE_SYNC_JOB_SETTINGS_ID },
        data: { lastRunAt: now },
      });
    }

    return {
      checked: batch.length,
      updated,
      failed,
      cycleComplete: remaining === 0,
    };
  } finally {
    endBackgroundTask();
  }
}

export async function runScheduledListingPriceSyncIfDue(): Promise<boolean> {
  const settings = await getOrCreateListingPriceSyncJobSettings();
  const timeZone = await getAppTimeZone();
  const now = new Date();
  const due = isListingPriceSyncDue(settings, now, timeZone);
  const pending = await countApartmentsDueForListingPriceCheck(settings, now, timeZone);

  if (!due && pending === 0) return false;

  const result = await runListingPriceSyncTick();
  return result.checked > 0 || result.updated > 0;
}
