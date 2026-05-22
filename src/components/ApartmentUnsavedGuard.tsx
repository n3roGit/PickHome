"use client";

import { APARTMENT_DRAFT_RESTORED_EVENT } from "@/lib/apartment-listing-draft";
import { UnsavedGuard } from "@/components/UnsavedGuard";

export function ApartmentUnsavedGuard({
  apartmentId,
  resetKey,
  children,
}: {
  apartmentId: string;
  resetKey: string;
  children: React.ReactNode;
}) {
  return (
    <UnsavedGuard
      rootId={`apartment-page-${apartmentId}`}
      resetKey={resetKey}
      rescanEvents={[APARTMENT_DRAFT_RESTORED_EVENT]}
    >
      {children}
    </UnsavedGuard>
  );
}
