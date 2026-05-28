import { refreshApartmentLocationInsightsAction } from "@/app/actions";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { OverpassPoiMap } from "@/components/OverpassPoiMap";
import { formatDateTimeDe } from "@/lib/dates";
import {
  FLOOD_SCENARIO_LABELS,
  type FloodBfgData,
  type FloodScenarioId,
} from "@/lib/flood-bfg";
import type { LocationInsightSnapshot } from "@/lib/location-insight-cache";
import type { ApartmentLocationInsightsBundle } from "@/lib/location-insights";
import {
  buildNoiseHumanSummary,
  type NoiseUbaData,
} from "@/lib/noise-uba";
import type { OverpassPoiData } from "@/lib/overpass-poi";

function StatusMessage({
  status,
  errorMessage,
}: {
  status: string;
  errorMessage: string | null;
}) {
  if (status === "no_coords") {
    return (
      <p className="text-sm text-pn-text-secondary">
        Adresse geocodieren, um Standortdaten abzurufen.
      </p>
    );
  }
  if (status === "error") {
    return (
      <p className="text-sm text-pn-score-low">
        Abruf fehlgeschlagen{errorMessage ? ` (${errorMessage})` : ""}.
      </p>
    );
  }
  return null;
}

function latestFetchedAt(bundle: ApartmentLocationInsightsBundle): Date {
  return new Date(
    Math.max(
      bundle.overpass.fetchedAt.getTime(),
      bundle.noise.fetchedAt.getTime(),
      bundle.flood.fetchedAt.getTime()
    )
  );
}

function LocationInsightsRefreshFooter({
  apartmentId,
  fetchedAt,
}: {
  apartmentId: string;
  fetchedAt: Date;
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-pn-border pt-4">
      <p className="text-xs text-pn-text-tertiary">Stand: {formatDateTimeDe(fetchedAt)}</p>
      <form action={refreshApartmentLocationInsightsAction.bind(null, apartmentId)}>
        <button
          type="submit"
          className="rounded-lg border border-pn-border bg-pn-bg-surface px-3 py-1.5 text-sm text-pn-text-secondary hover:text-pn-text-primary"
        >
          Aktualisieren
        </button>
      </form>
    </div>
  );
}

function OverpassBlock({
  snapshot,
  latitude,
  longitude,
}: {
  snapshot: LocationInsightSnapshot<OverpassPoiData>;
  latitude: number | null;
  longitude: number | null;
}) {
  const data = snapshot.data;

  return (
    <CollapsibleSection
      title="Umgebung"
      subtitle="Infrastruktur und Einrichtungen im Umkreis 500 m und 1 km"
      defaultOpen={snapshot.status === "ok"}
      className="mb-3"
    >
      <StatusMessage status={snapshot.status} errorMessage={snapshot.errorMessage} />
      {snapshot.status === "ok" && data && latitude != null && longitude != null ? (
        <OverpassPoiMap latitude={latitude} longitude={longitude} data={data} />
      ) : snapshot.status === "no_data" ? (
        <p className="text-sm text-pn-text-secondary">Keine POIs im Suchradius gefunden.</p>
      ) : null}
      <p className="mt-3 text-xs text-pn-text-tertiary">
        Orientierungswerte aus öffentlichen Kartendaten — keine Vollständigkeitsgarantie.
      </p>
    </CollapsibleSection>
  );
}

function NoiseBlock({ snapshot }: { snapshot: LocationInsightSnapshot<NoiseUbaData> }) {
  const hits = snapshot.data?.hits ?? [];
  const summary = buildNoiseHumanSummary(hits);

  const levelBadgeClass =
    summary.overallLevel === "very_loud" || summary.overallLevel === "loud"
      ? "bg-pn-score-low-bg text-pn-score-low"
      : summary.overallLevel === "moderate"
        ? "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200"
        : summary.overallLevel === "quiet"
          ? "bg-pn-score-high-bg text-pn-score-high"
          : "";

  return (
    <CollapsibleSection
      title="Lärm (UBA)"
      subtitle="EU-Umgebungslärmkartierung — nur Hauptverkehr und Ballungsräume"
      defaultOpen={hits.length > 0}
      className="mb-3"
    >
      <StatusMessage status={snapshot.status} errorMessage={snapshot.errorMessage} />
      {snapshot.status === "ok" && summary.sources.length > 0 ? (
        <div className="space-y-3">
          <p
            className={`rounded-lg px-3 py-2 text-sm font-medium ${
              levelBadgeClass || "bg-pn-bg-subtle text-pn-text-primary"
            }`}
          >
            {summary.headline}
          </p>
          <ul className="space-y-2">
            {summary.sources.map((src) => (
              <li
                key={src.source}
                className="rounded-lg border border-pn-border bg-pn-bg-subtle px-3 py-2 text-sm"
              >
                <p className="font-medium text-pn-text-primary">{src.sourceLabel}</p>
                <ul className="mt-1 space-y-1 text-pn-text-secondary">
                  {src.lines.map((line) => (
                    <li key={line.metricLabel}>
                      {line.metricLabel}:{" "}
                      <span className="text-pn-text-primary">{line.bandHuman}</span>
                      {" · "}
                      <span className="text-pn-text-tertiary">{line.assessment}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          <p className="text-xs text-pn-text-tertiary">
            Grobe Einordnung nach EU-Lärmkarte (Hauptstraßen &gt;3 Mio. Kfz/Jahr, Hauptschienen,
            Flughäfen). Keine Messung vor Ort — Kleinststraßen und Nachbarschaftslärm fehlen oft.
          </p>
        </div>
      ) : snapshot.status === "ok" || snapshot.status === "no_data" ? (
        <p className="text-sm text-pn-text-secondary">
          Kein Treffer in der UBA-Karte. Die kartiert nur Hauptverkehrsstraßen (&gt;3 Mio.
          Kfz/Jahr), Haupteisenbahnstrecken, Großflughäfen und Ballungsräume — kein Treffer
          bedeutet nicht „leise“.
        </p>
      ) : null}
      <p className="mt-3 text-xs text-pn-text-tertiary">
        Quelle:{" "}
        <a
          href="https://datahub.uba.de/server/rest/services/VeLa/LK/MapServer"
          target="_blank"
          rel="noreferrer"
          className="text-pn-accent hover:underline"
        >
          UBA Lärmkartierung
        </a>{" "}
        — Orientierung, keine Immissionsprognose vor Ort.
      </p>
    </CollapsibleSection>
  );
}

function floodBadgeClass(status: "betroffen" | "nicht_betroffen"): string {
  return status === "betroffen"
    ? "bg-pn-score-low-bg text-pn-score-low"
    : "bg-pn-score-high-bg text-pn-score-high";
}

function FloodBlock({ snapshot }: { snapshot: LocationInsightSnapshot<FloodBfgData> }) {
  const data = snapshot.data;

  return (
    <CollapsibleSection
      title="Hochwasser (BfG)"
      subtitle="Überflutungsrisikozonen nach HWRM-RL (3. Zyklus)"
      defaultOpen={
        data != null &&
        (data.scenarios.HQ100 === "betroffen" || data.scenarios.HQextrem === "betroffen")
      }
      className="mb-0"
    >
      <StatusMessage status={snapshot.status} errorMessage={snapshot.errorMessage} />
      {snapshot.status === "ok" && data ? (
        <ul className="flex flex-wrap gap-2">
          {(["HQhaeufig", "HQ100", "HQextrem"] as FloodScenarioId[]).map((id) => (
            <li
              key={id}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${floodBadgeClass(data.scenarios[id])}`}
            >
              {FLOOD_SCENARIO_LABELS[id]}:{" "}
              {data.scenarios[id] === "betroffen" ? "betroffen" : "nicht betroffen"}
            </li>
          ))}
        </ul>
      ) : snapshot.status === "no_data" ? (
        <p className="text-sm text-pn-text-secondary">
          Kein Überflutungsrisiko in den BfG-Zonen an diesem Punkt (nur Flusshochwasser).
        </p>
      ) : null}
      <p className="mt-3 text-xs text-pn-text-tertiary">
        BfG/LAWA Überflutungsrisikozonen (3. Zyklus 2022–2027). Nur Flusshochwasser — kein
        Starkregen, kein Grundwasser, keine Versicherungszone (ZÜRS).
      </p>
    </CollapsibleSection>
  );
}

export function ApartmentLocationInsights({
  apartmentId,
  bundle,
  latitude,
  longitude,
}: {
  apartmentId: string;
  bundle: ApartmentLocationInsightsBundle;
  latitude: number | null;
  longitude: number | null;
}) {
  const fetchedAt = latestFetchedAt(bundle);

  return (
    <CollapsibleSection
      title="Standort & Umfeld"
      subtitle="Umgebung, Lärm und Hochwasser — bundesweit, unverbindlich."
      defaultOpen={false}
    >
      <div id="location-insights" className="space-y-3">
        <OverpassBlock
          snapshot={bundle.overpass}
          latitude={latitude}
          longitude={longitude}
        />
        <NoiseBlock snapshot={bundle.noise} />
        <FloodBlock snapshot={bundle.flood} />
      </div>
      <LocationInsightsRefreshFooter apartmentId={apartmentId} fetchedAt={fetchedAt} />
    </CollapsibleSection>
  );
}
