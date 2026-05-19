import { updateApartmentDescriptionAction } from "@/app/actions";

export function ApartmentDescriptionForm({
  apartmentId,
  description,
  saved,
}: {
  apartmentId: string;
  description: string | null;
  saved?: boolean;
}) {
  return (
    <section className="bg-pn-bg-surface border border-pn-border rounded-xl p-5 mb-6">
      <h2 className="font-semibold mb-1">Beschreibung</h2>
      <p className="text-sm text-pn-text-secondary mb-4">
        Objektbeschreibung aus dem Inserat oder Exposé — durchsuchbar im Projekt.
      </p>
      {saved && (
        <p className="text-sm text-pn-score-high bg-pn-score-high-bg px-3 py-2 rounded-lg mb-4">
          Beschreibung gespeichert.
        </p>
      )}
      <form action={updateApartmentDescriptionAction.bind(null, apartmentId)}>
        <textarea
          name="description"
          rows={5}
          defaultValue={description ?? ""}
          placeholder="z. B. Ausstattung, Zustand, Besonderheiten aus dem Exposé …"
          className="w-full border border-pn-border rounded-lg px-3 py-2 text-sm resize-y min-h-[120px]"
        />
        <button
          type="submit"
          className="mt-3 bg-pn-accent text-white font-semibold px-4 py-2 rounded-lg text-sm"
        >
          Speichern
        </button>
      </form>
    </section>
  );
}
