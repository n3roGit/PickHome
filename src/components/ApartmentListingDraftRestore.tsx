"use client";

import { useEffect } from "react";
import {
  APARTMENT_DRAFT_RESTORED_EVENT,
  type ApartmentListingSavedFlags,
  keysForSavedFlags,
  pruneApartmentListingDraft,
  readApartmentListingDraft,
  writeApartmentListingDraft,
} from "@/lib/apartment-listing-draft";
import {
  applyListingPreviewToApartment,
  clearPrefilledHighlightsForKeys,
} from "@/lib/listing-import-form";

export function ApartmentListingDraftRestore({
  apartmentId,
  resetKey,
  saved,
}: {
  apartmentId: string;
  resetKey: string;
  saved: ApartmentListingSavedFlags;
}) {
  useEffect(() => {
    const page = document.getElementById(`apartment-page-${apartmentId}`);
    if (page) {
      clearPrefilledHighlightsForKeys(page, keysForSavedFlags(saved));
    }

    const draft = readApartmentListingDraft(apartmentId);
    if (!draft) return;

    const pruned = pruneApartmentListingDraft(draft, saved);
    writeApartmentListingDraft(apartmentId, pruned);
    if (!pruned) return;

    applyListingPreviewToApartment(apartmentId, pruned.fields, {
      onlyEmpty: false,
      highlightKeys: pruned.pending,
      clearHighlights: false,
    });

    window.dispatchEvent(
      new CustomEvent(APARTMENT_DRAFT_RESTORED_EVENT, { detail: { apartmentId } })
    );
  }, [apartmentId, resetKey, saved.title, saved.description, saved.basics, saved.broker]);

  return null;
}
