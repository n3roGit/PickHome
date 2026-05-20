import { updateApartmentNotesAction } from "@/app/actions";
import { CollapsibleSection } from "@/components/CollapsibleSection";

export function ApartmentNotesForm({
  apartmentId,
  notes,
  saved,
}: {
  apartmentId: string;
  notes: string | null;
  saved?: boolean;
}) {
  return (
    <CollapsibleSection
      title="Notizen"
      subtitle="Eigene Anmerkungen zu dieser Immobilie — für dich und dein Team im Projekt sichtbar."
      defaultOpen
    >
      {saved && (
        <p className="text-sm text-pn-score-high bg-pn-score-high-bg px-3 py-2 rounded-lg mb-4">
          Notizen gespeichert.
        </p>
      )}
      <form action={updateApartmentNotesAction.bind(null, apartmentId)}>
        <textarea
          name="notes"
          rows={5}
          defaultValue={notes ?? ""}
          placeholder="z. B. Eindruck nach Besichtigung, offene Fragen, Verhandlungsspielraum …"
          className="w-full border border-pn-border rounded-lg px-3 py-2 text-sm resize-y min-h-[120px]"
        />
        <button
          type="submit"
          className="mt-3 bg-pn-accent text-white font-semibold px-4 py-2 rounded-lg text-sm"
        >
          Speichern
        </button>
      </form>
    </CollapsibleSection>
  );
}
