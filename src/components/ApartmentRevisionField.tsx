import { APARTMENT_REVISION_FIELD } from "@/lib/apartment-revision";

export function ApartmentRevisionField({ revision }: { revision: number }) {
  return <input type="hidden" name={APARTMENT_REVISION_FIELD} value={String(revision)} />;
}
