import { updateApartmentTitleAction } from "@/app/actions";

export function ApartmentTitleForm({
  apartmentId,
  title,
  saved,
  empty,
}: {
  apartmentId: string;
  title: string;
  saved?: boolean;
  empty?: boolean;
}) {
  return (
    <form action={updateApartmentTitleAction.bind(null, apartmentId)} className="w-full min-w-0">
      {saved && (
        <p className="text-sm text-pn-score-high bg-pn-score-high-bg px-3 py-2 rounded-lg mb-2">
          Anzeigename gespeichert.
        </p>
      )}
      {empty && (
        <p className="text-sm text-pn-score-low bg-pn-score-low-bg px-3 py-2 rounded-lg mb-2">
          Bitte einen Anzeigenamen eingeben.
        </p>
      )}
      <label className="block">
        <span className="text-sm font-medium text-pn-text-secondary">Anzeigename</span>
        <input
          name="title"
          required
          defaultValue={title}
          className="mt-1 w-full border border-pn-border rounded-lg px-3 py-2 text-xl sm:text-2xl font-bold"
        />
      </label>
      <button
        type="submit"
        className="mt-2 bg-pn-accent text-white font-semibold px-4 py-2 rounded-lg text-sm"
      >
        Speichern
      </button>
    </form>
  );
}
