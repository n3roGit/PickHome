import { refreshApartmentLocationInsightsAction } from "@/app/actions";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { formatDateTimeDe } from "@/lib/dates";
import {
  FLOOD_SCENARIO_LABELS,
  type FloodBfgData,
  type FloodScenarioId,
} from "@/lib/flood-bfg";
import type { LocationInsightSnapshot } from "@/lib/location-insight-cache";
import type { ApartmentLocationInsightsBundle } from "@/lib/location-insights";
import {
  formatNoiseHitLine,
  type NoiseUbaData,
} from "@/lib/noise-uba";
import {
  osmLinkForPoi,
  POI_CATEGORY_LABELS,
  type OverpassPoiData,
  type PoiCategoryId,
} from "@/lib/overpass-poi";

const POI_ORDER: PoiCategoryId[] = [
  "supermarket",
  "pharmacy",
  "school",
  "kindergarten",
  "publicTransport",
  "park",
  "medical",
];

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

function RefreshForm({
  apartmentId,
  domain,
  label,
}: {
  apartmentId: string;
  domain?: string;
  label: string;
}) {
  return (
    <form action={refreshApartmentLocationInsightsAction.bind(null, apartmentId)}>
      {domain ? <input type="hidden" name="domain" value={domain} /> : null}
      <button
        type="submit"
        className="text-xs text-pn-accent hover:underline"
      >
        {label}
      </button>
    </form>
  );
}

function OverpassBlock({
  apartmentId,
  snapshot,
}: {
  apartmentId: string;
  snapshot: LocationInsightSnapshot<OverpassPoiData>;
}) {
  const fetchedAt = formatDateTimeDe(snapshot.fetchedAt);
  const data = snapshot.data;

  return (
    <CollapsibleSection
      title="Umgebung (OpenStreetMap)"
      subtitle={`POIs im Umkreis · Stand ${fetchedAt}`}
      defaultOpen={snapshot.status === "ok"}
      headerAside={
        <RefreshForm apartmentId={apartmentId} domain="overpass" label="Aktualisieren" />
      }
    >
      <StatusMessage status={snapshot.status} errorMessage={snapshot.errorMessage} />
      {snapshot.status === "ok" && data ? (
        <ul className="grid gap-2 sm:grid-cols-2">
          {POI_ORDER.map((id) => {
            const cat = data.categories[id];
            const nearest = cat.nearest;
            return (
              <li
                key={id}
                className="rounded-lg border border-pn-border bg-pn-bg-subtle px-3 py-2 text-sm"
              >
                <p className="font-medium text-pn-text-primary">{POI_CATEGORY_LABELS[id]}</p>
                <p className="text-pn-text-secondary">
                  {cat.countClose} (500 m) · {cat.countWide} (1 km)
                </p>
                {nearest ? (
                  <p className="mt-1 text-xs text-pn-text-tertiary">
                    Nächste:{" "}
                    {nearest.name ? (
                      <a
                        href={osmLinkForPoi(nearest)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-pn-accent hover:underline"
                      >
                        {nearest.name}
                      </a>
                    ) : (
                      "Unbenannt"
                    )}{" "}
                    · {nearest.distanceM} m
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-pn-text-tertiary">Keine Treffer im Umkreis</p>
                )}
              </li>
            );
          })}
        </ul>
      ) : snapshot.status === "no_data" ? (
        <p className="text-sm text-pn-text-secondary">Keine POIs im Suchradius gefunden.</p>
      ) : null}
      <p className="mt-3 text-xs text-pn-text-tertiary">
        Daten:{" "}
        <a
          href="https://www.openstreetmap.org"
          target="_blank"
          rel="noreferrer"
          className="text-pn-accent hover:underline"
        >
          OpenStreetMap
        </a>{" "}
        via Overpass API — Orientierung, keine Vollständigkeitsgarantie.
      </p>
    </CollapsibleSection>
  );
}

function NoiseBlock({
  apartmentId,
  snapshot,
}: {
  apartmentId: string;
  snapshot: LocationInsightSnapshot<NoiseUbaData>;
}) {
  const fetchedAt = formatDateTimeDe(snapshot.fetchedAt);
  const hits = snapshot.data?.hits ?? [];

  return (
    <CollapsibleSection
      title="Lärm (UBA)"
      subtitle={`EU-Umgebungslärmkartierung · Stand ${fetchedAt}`}
      defaultOpen={hits.length > 0}
      headerAside={
        <RefreshForm apartmentId={apartmentId} domain="noise" label="Aktualisieren" />
      }
    >
      <StatusMessage status={snapshot.status} errorMessage={snapshot.errorMessage} />
      {snapshot.status === "ok" && hits.length > 0 ? (
        <ul className="space-y-2">
          {hits.map((hit, i) => (
            <li
              key={`${hit.layerName}-${i}`}
              className="rounded-lg border border-pn-border bg-pn-bg-subtle px-3 py-2 text-sm"
            >
              {formatNoiseHitLine(hit)}
            </li>
          ))}
        </ul>
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

function FloodBlock({
  apartmentId,
  snapshot,
}: {
  apartmentId: string;
  snapshot: LocationInsightSnapshot<FloodBfgData>;
}) {
  const fetchedAt = formatDateTimeDe(snapshot.fetchedAt);
  const data = snapshot.data;

  return (
    <CollapsibleSection
      title="Hochwasser (BfG)"
      subtitle={`Überflutungsrisikozonen HWRM-RL · Stand ${fetchedAt}`}
      defaultOpen={
        data != null &&
        (data.scenarios.HQ100 === "betroffen" || data.scenarios.HQextrem === "betroffen")
      }
      headerAside={
        <RefreshForm apartmentId={apartmentId} domain="flood" label="Aktualisieren" />
      }
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
}: {
  apartmentId: string;
  bundle: ApartmentLocationInsightsBundle;
}) {
  return (
    <CollapsibleSection
      title="Standort & Umfeld"
      subtitle="OpenStreetMap, UBA-Lärm, BfG-Hochwasser — bundesweit, unverbindlich."
      defaultOpen={false}
      headerAside={
        <RefreshForm apartmentId={apartmentId} label="Alle aktualisieren" />
      }
    >
      <div id="location-insights" className="space-y-3">
        <OverpassBlock apartmentId={apartmentId} snapshot={bundle.overpass} />
        <NoiseBlock apartmentId={apartmentId} snapshot={bundle.noise} />
        <FloodBlock apartmentId={apartmentId} snapshot={bundle.flood} />
      </div>
    </CollapsibleSection>
  );
}
