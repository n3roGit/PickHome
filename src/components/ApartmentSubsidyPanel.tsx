import type { SubsidyMatch, SubsidyMatchStatus } from "@/lib/subsidy-matching";
import type { SubsidyProgramKind } from "@/lib/subsidy-programs";

const STATUS_LABELS: Record<SubsidyMatchStatus, string> = {
  relevant: "Relevant",
  possible: "Möglich",
  "needs-data": "Daten fehlen",
};

const STATUS_CLASSES: Record<SubsidyMatchStatus, string> = {
  relevant: "text-pn-score-high bg-pn-score-high-bg",
  possible: "text-pn-text-secondary bg-pn-bg-subtle",
  "needs-data": "text-pn-text-tertiary bg-pn-bg-subtle border border-pn-border",
};

const KIND_LABELS: Record<SubsidyProgramKind, string> = {
  credit: "Kredit",
  grant: "Zuschuss",
  research: "Recherche",
};

function SubsidyCard({ match }: { match: SubsidyMatch }) {
  const { program, status, reason, missingData, nextStep } = match;

  return (
    <article className="border border-pn-border rounded-lg p-4 bg-pn-bg-base">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <h3 className="font-medium text-sm">{program.name}</h3>
          <p className="text-xs text-pn-text-tertiary mt-0.5">
            {program.provider} · {KIND_LABELS[program.kind]}
          </p>
        </div>
        <span
          className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded ${STATUS_CLASSES[status]}`}
        >
          {STATUS_LABELS[status]}
        </span>
      </div>
      <p className="text-sm text-pn-text-secondary mb-2">{program.summary}</p>
      <p className="text-sm font-medium text-pn-text-primary mb-3">{program.maxFundingLabel}</p>
      <dl className="space-y-2 text-sm mb-3">
        <div>
          <dt className="text-pn-text-tertiary text-xs">Warum angezeigt?</dt>
          <dd className="text-pn-text-secondary">{reason}</dd>
        </div>
        {missingData.length > 0 && (
          <div>
            <dt className="text-pn-text-tertiary text-xs">Noch prüfen</dt>
            <dd className="text-pn-text-secondary">{missingData.join(" · ")}</dd>
          </div>
        )}
        <div>
          <dt className="text-pn-text-tertiary text-xs">Nächster Schritt</dt>
          <dd className="text-pn-text-secondary">{nextStep}</dd>
        </div>
      </dl>
      <a
        href={program.url}
        target="_blank"
        rel="noreferrer noopener"
        className="text-sm text-pn-accent hover:underline"
      >
        Offizielle Informationen ↗
      </a>
    </article>
  );
}

export function ApartmentSubsidyPanel({ matches }: { matches: SubsidyMatch[] }) {
  const needsDataOnly =
    matches.length > 0 && matches.every((m) => m.status === "needs-data");

  return (
    <div>
      <p className="text-sm text-pn-text-secondary mb-4">
        Unverbindliche Hinweise auf mögliche Förderprogramme. Kein Rechtsanspruch – vor
        Antragstellung individuelle Beratung und offizielle Konditionen prüfen.
      </p>
      {needsDataOnly && (
        <p className="text-sm text-pn-text-secondary bg-pn-bg-subtle border border-pn-border rounded-lg px-3 py-2 mb-4">
          Für genauere Förderhinweise Baujahr, Energieklasse und Sanierungskosten in{" "}
          <strong>Preis & Adresse</strong> ergänzen.
        </p>
      )}
      <div className="space-y-3">
        {matches.map((match) => (
          <SubsidyCard key={match.program.id} match={match} />
        ))}
      </div>
    </div>
  );
}
