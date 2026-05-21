export const PRICE_HISTORY_SOURCE_MANUAL = "manual";
export const PRICE_HISTORY_SOURCE_LISTING_SYNC = "listing_sync";
export const PRICE_HISTORY_SOURCE_SNAPSHOT = "snapshot";

export function priceHistorySourceLabelDe(source: string): string {
  switch (source) {
    case PRICE_HISTORY_SOURCE_LISTING_SYNC:
      return "Inserat (automatisch)";
    case PRICE_HISTORY_SOURCE_SNAPSHOT:
      return "Bestand";
    case PRICE_HISTORY_SOURCE_MANUAL:
    default:
      return "Manuell";
  }
}
