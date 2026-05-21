import {
  PRICE_HISTORY_SOURCE_LISTING_SYNC,
  PRICE_HISTORY_SOURCE_MANUAL,
  PRICE_HISTORY_SOURCE_SNAPSHOT,
} from "@/lib/apartment-price-history-labels";
import { prisma } from "@/lib/prisma";

export {
  PRICE_HISTORY_SOURCE_LISTING_SYNC,
  PRICE_HISTORY_SOURCE_MANUAL,
  PRICE_HISTORY_SOURCE_SNAPSHOT,
} from "@/lib/apartment-price-history-labels";

export type ApartmentPriceHistorySource =
  | typeof PRICE_HISTORY_SOURCE_MANUAL
  | typeof PRICE_HISTORY_SOURCE_LISTING_SYNC
  | typeof PRICE_HISTORY_SOURCE_SNAPSHOT;

export async function recordApartmentPriceChange(
  apartmentId: string,
  newPrice: number | null,
  previousPrice: number | null,
  source: ApartmentPriceHistorySource
): Promise<boolean> {
  if (newPrice == null || !Number.isFinite(newPrice) || newPrice <= 0) return false;
  if (previousPrice === newPrice) return false;

  await prisma.apartmentPriceHistory.create({
    data: {
      apartmentId,
      price: newPrice,
      previousPrice,
      source,
    },
  });
  return true;
}

export async function applyApartmentPriceUpdate(
  apartmentId: string,
  newPrice: number | null,
  source: ApartmentPriceHistorySource
): Promise<{ changed: boolean; previousPrice: number | null }> {
  const apt = await prisma.apartment.findUnique({
    where: { id: apartmentId },
    select: { price: true },
  });
  const previousPrice = apt?.price ?? null;
  if (previousPrice === newPrice) {
    return { changed: false, previousPrice };
  }

  await prisma.apartment.update({
    where: { id: apartmentId },
    data: { price: newPrice },
  });

  if (newPrice != null) {
    await recordApartmentPriceChange(apartmentId, newPrice, previousPrice, source);
  }

  return { changed: true, previousPrice };
}

export async function getApartmentPriceHistory(apartmentId: string) {
  return prisma.apartmentPriceHistory.findMany({
    where: { apartmentId },
    orderBy: { recordedAt: "desc" },
    select: {
      id: true,
      price: true,
      previousPrice: true,
      source: true,
      recordedAt: true,
    },
  });
}

export async function countApartmentPriceHistory(apartmentId: string): Promise<number> {
  return prisma.apartmentPriceHistory.count({ where: { apartmentId } });
}

export async function backfillApartmentPriceHistorySnapshots(): Promise<number> {
  const apartments = await prisma.apartment.findMany({
    where: {
      price: { not: null },
      priceHistory: { none: {} },
    },
    select: { id: true, price: true, createdAt: true },
  });

  if (apartments.length === 0) return 0;

  await prisma.apartmentPriceHistory.createMany({
    data: apartments.map((a) => ({
      apartmentId: a.id,
      price: a.price!,
      previousPrice: null,
      source: PRICE_HISTORY_SOURCE_SNAPSHOT,
      recordedAt: a.createdAt,
    })),
  });

  return apartments.length;
}
