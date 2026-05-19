import { updateProjectAction } from "@/app/actions";

const settingsErrors: Record<string, string> = {
  name: "Bitte einen Projektnamen angeben.",
};

export function ProjectSettingsPanel({
  projectId,
  name,
  budget,
  saved,
  error,
}: {
  projectId: string;
  name: string;
  budget: number | null;
  saved?: boolean;
  error?: string;
}) {
  return (
    <div className="space-y-6">
      {saved && (
        <p className="text-sm text-pn-score-high bg-pn-score-high-bg px-3 py-2 rounded-lg">
          Projekteinstellungen wurden gespeichert.
        </p>
      )}
      {error && settingsErrors[error] && (
        <p className="text-sm text-pn-score-low bg-pn-score-low-bg px-3 py-2 rounded-lg">
          {settingsErrors[error]}
        </p>
      )}

      <section className="bg-pn-bg-surface border border-pn-border rounded-xl p-5 max-w-lg">
        <h2 className="font-semibold mb-1">Projekt</h2>
        <p className="text-sm text-pn-text-secondary mb-4">
          Name und Budget können jederzeit angepasst werden.
        </p>
        <form action={updateProjectAction.bind(null, projectId)} className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-pn-text-secondary">Projektname</span>
            <input
              name="name"
              defaultValue={name}
              required
              className="mt-1 w-full border border-pn-border rounded-lg px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-pn-text-secondary">Budget (optional)</span>
            <input
              name="budget"
              defaultValue={budget != null ? String(budget) : ""}
              placeholder="z. B. 350000"
              className="mt-1 w-full border border-pn-border rounded-lg px-3 py-2 text-sm"
            />
          </label>
          <button
            type="submit"
            className="bg-pn-accent text-white font-semibold px-4 py-2 rounded-lg text-sm"
          >
            Speichern
          </button>
        </form>
      </section>
    </div>
  );
}
