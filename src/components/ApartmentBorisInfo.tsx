import { refreshApartmentBorisAction } from "@/app/actions";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { formatDateTimeDe } from "@/lib/dates";
import type { ApartmentBorisSnapshot } from "@/lib/boris-cache";
import type { BorisResult } from "@/lib/boris";

function formatStichtag(value: string | null): string | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;
  return `${match[3]}.${match[2]}.${match[1]}`;
}

function buildDetailLine(result: BorisResult): string {
  const parts: string[] = [];
  const stichtag = formatStichtag(result.stichtag);
  if (stichtag) parts.push(`Stichtag ${stichtag}`);
  if (result.gemeinde) parts.push(result.gemeinde);
  if (result.entwicklungszustand) parts.push(result.entwicklungszustand);
  if (result.beitragsrecht) parts.push(result.beitragsrecht);
  return parts.join(" · ");
}

function buildSubline(result: BorisResult): string {
  const parts: string[] = [];
  if (result.nutzungsartLabel) parts.push(result.nutzungsartLabel);
  if (result.erganzungLabel) parts.push(result.erganzungLabel);
  if (result.zoneNumber) {
    parts.push(result.zoneName ? `${result.zoneName}` : `Zone ${result.zoneNumber}`);
  }
  return parts.join(" · ");
}

function BorisResultRow({ result }: { result: BorisResult }) {
  const subline = buildSubline(result);
  const detailLine = buildDetailLine(result);

  return (
    <li className="rounded-lg border border-pn-border bg-pn-bg-subtle px-4 py-3">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-lg font-semibold text-pn-text-primary">
          {result.brwEurPerSqm.toLocaleString("de-DE")} €/m²
        </span>
        <span className="text-sm font-medium text-pn-text-secondary">{result.kategorieLabel}</span>
      </div>
      {subline ? <p className="mt-1 text-sm text-pn-text-secondary">{subline}</p> : null}
      {detailLine ? <p className="mt-1 text-xs text-pn-text-tertiary">{detailLine}</p> : null}
    </li>
  );
}

export function ApartmentBorisInfo({
  apartmentId,
  snapshot,
}: {
  apartmentId: string;
  snapshot: ApartmentBorisSnapshot;
}) {
  const fetchedAtLabel = formatDateTimeDe(snapshot.fetchedAt);

  return (
    <CollapsibleSection
      title="Bodenrichtwert (Info)"
      subtitle="Orientierungswerte aus BORIS-D — nicht in der Finanzrechnung enthalten."
      defaultOpen={snapshot.status === "ok"}
    >
      {snapshot.status === "ok" ? (
        <ul className="space-y-3">
          {snapshot.results.map((result) => (
            <BorisResultRow
              key={`${result.kategorie}-${result.zoneNumber ?? "na"}-${result.brwEurPerSqm}-${result.nutzungsart ?? "na"}`}
              result={result}
            />
          ))}
        </ul>
      ) : null}

      {snapshot.status === "no_coords" ? (
        <p className="text-sm text-pn-text-secondary">
          Für diese Wohnung liegen noch keine Koordinaten vor. Adresse speichern und Geocoding
          ausführen, dann erneut aktualisieren.
        </p>
      ) : null}

      {snapshot.status === "no_data" ? (
        <p className="text-sm text-pn-text-secondary">
          Keine Bodenrichtwertzone für diese Koordinaten gefunden.
        </p>
      ) : null}

      {snapshot.status === "error" ? (
        <p className="text-sm text-pn-score-low">
          Bodenrichtwert konnte nicht abgerufen werden
          {snapshot.errorMessage ? `: ${snapshot.errorMessage}` : "."}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-pn-border pt-4">
        <p className="text-xs text-pn-text-tertiary">Stand: {fetchedAtLabel}</p>
        <form action={refreshApartmentBorisAction.bind(null, apartmentId)}>
          <button
            type="submit"
            className="rounded-lg border border-pn-border bg-pn-bg-surface px-3 py-1.5 text-sm text-pn-text-secondary hover:text-pn-text-primary"
          >
            Aktualisieren
          </button>
        </form>
      </div>

      <p className="mt-3 text-xs text-pn-text-tertiary">
        Quelle:{" "}
        <a
          href="https://www.bodenrichtwerte-boris.de/boris-d/?lang=de"
          className="text-pn-accent hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          BORIS-D
        </a>{" "}
        · Daten der Gutachterausschüsse für Grundstückswerte, dl-de/by-2-0. Orientierungswert,
        keine amtliche Wertermittlung, keine Berechnungsgrundlage.
      </p>
    </CollapsibleSection>
  );
}
