"use client";

import { useEffect } from "react";
import { APARTMENT_DRAFT_RESTORED_EVENT } from "@/lib/apartment-listing-draft";
import { syncListingFieldSuggestionsFromDraft } from "@/lib/listing-field-suggestions";

export function ApartmentListingFieldSuggestions({
  apartmentId,
  resetKey,
}: {
  apartmentId: string;
  resetKey: string;
}) {
  useEffect(() => {
    const run = () => syncListingFieldSuggestionsFromDraft(apartmentId);

    run();

    const onDraft = (e: Event) => {
      const detail = (e as CustomEvent<{ apartmentId: string }>).detail;
      if (detail?.apartmentId === apartmentId) run();
    };

    window.addEventListener(APARTMENT_DRAFT_RESTORED_EVENT, onDraft);
    return () => {
      window.removeEventListener(APARTMENT_DRAFT_RESTORED_EVENT, onDraft);
    };
  }, [apartmentId, resetKey]);

  return null;
}
