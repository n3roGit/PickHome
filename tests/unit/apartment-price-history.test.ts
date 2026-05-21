import { describe, expect, it } from "vitest";
import { priceHistorySourceLabelDe } from "@/lib/apartment-price-history-labels";
import {
  PRICE_HISTORY_SOURCE_LISTING_SYNC,
  PRICE_HISTORY_SOURCE_MANUAL,
  PRICE_HISTORY_SOURCE_SNAPSHOT,
} from "@/lib/apartment-price-history-labels";

describe("apartment price history labels", () => {
  it("maps known sources to German labels", () => {
    expect(priceHistorySourceLabelDe(PRICE_HISTORY_SOURCE_MANUAL)).toBe("Manuell");
    expect(priceHistorySourceLabelDe(PRICE_HISTORY_SOURCE_LISTING_SYNC)).toBe(
      "Inserat (automatisch)"
    );
    expect(priceHistorySourceLabelDe(PRICE_HISTORY_SOURCE_SNAPSHOT)).toBe("Bestand");
  });
});
