import {
  reindexProjectCommuteAction,
  reindexProjectDocumentsAction,
  updateProjectAction,
} from "@/app/actions";
import {
  FEDERAL_STATES,
  formatBrokerBuyerRateForInput,
  formatInterestRateForInput,
} from "@/lib/purchase-costs";

const settingsErrors: Record<string, string> = {
  name: "Bitte einen Projektnamen angeben.",
};

export function ProjectSettingsPanel({
  projectId,
  name,
  budget,
  federalStateCode,
  brokerBuyerRate,
  equityAmount,
  loanTermYears,
  interestRate,
  netHouseholdIncome,
  dealbreakerThreshold,
  saved,
  error,
  reindexResult,
  commuteReindexResult,
}: {
  projectId: string;
  name: string;
  budget: number | null;
  federalStateCode: string | null;
  brokerBuyerRate: number | null;
  equityAmount: number | null;
  loanTermYears: number | null;
  interestRate: number | null;
  netHouseholdIncome: number | null;
  dealbreakerThreshold: number;
  saved?: boolean;
  error?: string;
  reindexResult?: {
    processed: number;
    withText: number;
    withoutText: number;
    missingFile: number;
  };
  commuteReindexResult?: {
    apartmentsTotal: number;
    apartmentsWithCoords: number;
    routesComputed: number;
    routesSkipped: number;
    routesFailed: number;
  };
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

      <form action={updateProjectAction.bind(null, projectId)} className="space-y-6 max-w-lg">
        <section className="bg-pn-bg-surface border border-pn-border rounded-xl p-5 space-y-4">
          <div>
            <h2 className="font-semibold mb-1">Projekt</h2>
            <p className="text-sm text-pn-text-secondary">Name und Budget für die Suche.</p>
          </div>
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
        </section>

        <section className="bg-pn-bg-surface border border-pn-border rounded-xl p-5 space-y-4">
          <div>
            <h2 className="font-semibold mb-1">Kaufnebenkosten</h2>
            <p className="text-sm text-pn-text-secondary">Annahmen für die Schätzung pro Immobilie.</p>
          </div>
          <label className="block">
            <span className="text-sm font-medium text-pn-text-secondary">Bundesland</span>
            <select
              name="federalStateCode"
              defaultValue={federalStateCode ?? ""}
              className="mt-1 w-full border border-pn-border rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="">— nicht festgelegt —</option>
              {FEDERAL_STATES.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-pn-text-secondary">
              Makleranteil Käufer (optional, %)
            </span>
            <input
              name="brokerBuyerRate"
              defaultValue={formatBrokerBuyerRateForInput(brokerBuyerRate)}
              placeholder="z. B. 2,975 — leer = Schätzung nach Bundesland"
              className="mt-1 w-full border border-pn-border rounded-lg px-3 py-2 text-sm"
            />
            <span className="text-xs text-pn-text-tertiary mt-1 block">
              Nur der Käuferanteil der Provision (nicht die Gesamtprovision).
            </span>
          </label>
        </section>

        <section className="bg-pn-bg-surface border border-pn-border rounded-xl p-5 space-y-4">
          <div>
            <h2 className="font-semibold mb-1">Finanzierung</h2>
            <p className="text-sm text-pn-text-secondary">
              Für die grobe Monatsrate und Belastbarkeit pro Immobilie.
            </p>
          </div>
          <label className="block">
            <span className="text-sm font-medium text-pn-text-secondary">Eigenkapital</span>
            <input
              name="equityAmount"
              defaultValue={equityAmount != null ? String(equityAmount) : ""}
              placeholder="z. B. 80000"
              className="mt-1 w-full border border-pn-border rounded-lg px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-pn-text-secondary">Abzahlungszeitraum (Jahre)</span>
            <input
              name="loanTermYears"
              type="number"
              min={1}
              max={50}
              defaultValue={loanTermYears ?? ""}
              placeholder="z. B. 25"
              className="mt-1 w-full border border-pn-border rounded-lg px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-pn-text-secondary">Sollzins (optional, % p.a.)</span>
            <input
              name="interestRate"
              defaultValue={formatInterestRateForInput(interestRate)}
              placeholder="z. B. 3,5 — leer = 3,5 % Standard"
              className="mt-1 w-full border border-pn-border rounded-lg px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-pn-text-secondary">
              Haushaltsnetto (optional, €/Monat)
            </span>
            <input
              name="netHouseholdIncome"
              defaultValue={netHouseholdIncome != null ? String(netHouseholdIncome) : ""}
              placeholder="z. B. 5500"
              className="mt-1 w-full border border-pn-border rounded-lg px-3 py-2 text-sm"
            />
            <span className="text-xs text-pn-text-tertiary mt-1 block">
              Für den Anteil der Monatsrate am Einkommen (Richtwert: max. ca. 35&nbsp;%).
            </span>
          </label>
        </section>

        <section className="bg-pn-bg-surface border border-pn-border rounded-xl p-5 space-y-4">
          <div>
            <h2 className="font-semibold mb-1">Bewertung</h2>
            <p className="text-sm text-pn-text-secondary">
              Schwelle für Dealbreaker-Kriterien in diesem Projekt.
            </p>
          </div>
          <label className="block">
            <span className="text-sm font-medium text-pn-text-secondary">
              Dealbreaker-Schwelle (0–10)
            </span>
            <input
              name="dealbreakerThreshold"
              type="number"
              min={0}
              max={10}
              defaultValue={dealbreakerThreshold}
              className="mt-1 w-full border border-pn-border rounded-lg px-3 py-2 text-sm"
            />
            <span className="text-xs text-pn-text-tertiary mt-1 block">
              Bei als Dealbreaker markierten Kriterien führt ein Wert ≤ Schwelle zum Ausschluss (Score 0 / DB).
              Standard: 3.
            </span>
          </label>
        </section>

        <button
          type="submit"
          className="bg-pn-accent text-white font-semibold px-4 py-2 rounded-lg text-sm"
        >
          Speichern
        </button>
      </form>

      <section className="bg-pn-bg-surface border border-pn-border rounded-xl p-5 max-w-lg space-y-4">
        <div>
          <h2 className="font-semibold mb-1">Volltextsuche</h2>
          <p className="text-sm text-pn-text-secondary">
            PDF-Exposés nachträglich einlesen, damit der Inhalt in der Suche gefunden wird.
          </p>
        </div>
        {reindexResult && (
          <p className="text-sm text-pn-score-high bg-pn-score-high-bg px-3 py-2 rounded-lg">
            {reindexResult.processed === 0
              ? "Keine PDFs in diesem Projekt."
              : `${reindexResult.processed} PDF(s) verarbeitet: ${reindexResult.withText} mit Text, ${reindexResult.withoutText} ohne Textlayer${reindexResult.missingFile > 0 ? `, ${reindexResult.missingFile} Datei(en) fehlen` : ""}.`}
          </p>
        )}
        <form action={reindexProjectDocumentsAction.bind(null, projectId)}>
          <button
            type="submit"
            className="bg-pn-bg-subtle border border-pn-border text-pn-text-primary font-medium px-4 py-2 rounded-lg text-sm hover:bg-pn-border/40"
          >
            PDFs neu einlesen
          </button>
        </form>
      </section>

      <section className="bg-pn-bg-surface border border-pn-border rounded-xl p-5 max-w-lg space-y-4">
        <div>
          <h2 className="font-semibold mb-1">Anfahrtszeiten</h2>
          <p className="text-sm text-pn-text-secondary">
            Entfernungen und Fahrzeiten aus den Koordinaten der Immobilien und der
            Team-Adressen (Kontoeinstellungen) neu berechnen. Bestehende Routen-Caches
            werden verworfen.
          </p>
        </div>
        {commuteReindexResult && (
          <p className="text-sm text-pn-score-high bg-pn-score-high-bg px-3 py-2 rounded-lg">
            {commuteReindexResult.apartmentsTotal === 0
              ? "Keine aktiven Immobilien in diesem Projekt."
              : `${commuteReindexResult.routesComputed} Route(n) berechnet (${commuteReindexResult.apartmentsWithCoords} von ${commuteReindexResult.apartmentsTotal} Immobilie(n) mit Koordinaten)${commuteReindexResult.routesSkipped > 0 ? `, ${commuteReindexResult.routesSkipped} übersprungen` : ""}${commuteReindexResult.routesFailed > 0 ? `, ${commuteReindexResult.routesFailed} fehlgeschlagen` : ""}.`}
          </p>
        )}
        <form action={reindexProjectCommuteAction.bind(null, projectId)}>
          <button
            type="submit"
            className="bg-pn-bg-subtle border border-pn-border text-pn-text-primary font-medium px-4 py-2 rounded-lg text-sm hover:bg-pn-border/40"
          >
            Koordinaten neu indizieren
          </button>
        </form>
      </section>
    </div>
  );
}
