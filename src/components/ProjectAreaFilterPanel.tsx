"use client";

import { useMemo, useState, useTransition } from "react";
import { updateProjectAreaFilterAction } from "@/app/actions";
import type { AreaFilterConfig } from "@/lib/area-filter";
import { defaultDistrictsForPlzSelection } from "@/lib/area-filter";
import { districtsForPlzList, type LocationCity } from "@/lib/location-areas";

type SavedConfig = {
  cityId: string | null;
  config: AreaFilterConfig | null;
};

export function ProjectAreaFilterPanel({
  projectId,
  saved,
  error,
  initial,
  catalog,
}: {
  projectId: string;
  saved?: boolean;
  error?: string;
  initial: SavedConfig;
  catalog: LocationCity[];
}) {
  const [cityId, setCityId] = useState(initial.cityId ?? "");
  const [selectedPlz, setSelectedPlz] = useState<string[]>(initial.config?.selectedPlz ?? []);
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>(
    initial.config?.selectedDistricts ?? []
  );
  const [pending, startTransition] = useTransition();

  const city = useMemo(
    () => catalog.find((c) => c.id === cityId) ?? null,
    [catalog, cityId]
  );

  const availableDistricts = useMemo(
    () => (city ? districtsForPlzList(city, selectedPlz) : []),
    [city, selectedPlz]
  );

  function handleCityChange(nextCityId: string) {
    setCityId(nextCityId);
    setSelectedPlz([]);
    setSelectedDistricts([]);
  }

  function togglePlz(plz: string, checked: boolean) {
    const nextPlz = checked
      ? [...selectedPlz, plz].sort()
      : selectedPlz.filter((p) => p !== plz);

    const added = checked ? plz : null;
    const removed = !checked ? plz : null;

    let nextDistricts = selectedDistricts.filter((d) => {
      if (!city) return false;
      if (removed) {
        const stillCovered = nextPlz.some((p) =>
          catalog
            .find((c) => c.id === cityId)
            ?.postalCodes.find((e) => e.plz === p)
            ?.districts.includes(d)
        );
        return stillCovered;
      }
      return true;
    });

    if (added && city) {
      const newDistricts = defaultDistrictsForPlzSelection(city, [added]);
      nextDistricts = [...new Set([...nextDistricts, ...newDistricts])].sort((a, b) =>
        a.localeCompare(b, "de")
      );
    }

    setSelectedPlz(nextPlz);
    setSelectedDistricts(nextDistricts);
  }

  function setAllPlz(all: boolean) {
    if (!city) return;
    const plzList = all ? city.postalCodes.map((p) => p.plz) : [];
    setSelectedPlz(plzList);
    setSelectedDistricts(all ? defaultDistrictsForPlzSelection(city, plzList) : []);
  }

  function toggleDistrict(district: string, checked: boolean) {
    setSelectedDistricts((prev) => {
      if (checked) {
        return [...new Set([...prev, district])].sort((a, b) => a.localeCompare(b, "de"));
      }
      return prev.filter((d) => d !== district);
    });
  }

  function setAllDistricts(all: boolean) {
    setSelectedDistricts(all ? availableDistricts : []);
  }

  function handleSave() {
    startTransition(() => {
      updateProjectAreaFilterAction(projectId, {
        cityId: cityId || null,
        selectedPlz,
        selectedDistricts,
      });
    });
  }

  function handleClear() {
    setCityId("");
    setSelectedPlz([]);
    setSelectedDistricts([]);
    startTransition(() => {
      updateProjectAreaFilterAction(projectId, {
        cityId: null,
        selectedPlz: [],
        selectedDistricts: [],
      });
    });
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {saved && (
        <p className="text-sm text-pn-score-high bg-pn-score-high-bg px-3 py-2 rounded-lg">
          Wunschgebiet wurde gespeichert.
        </p>
      )}
      {error === "city" && (
        <p className="text-sm text-pn-score-low bg-pn-score-low-bg px-3 py-2 rounded-lg">
          Bitte eine Stadt auswählen.
        </p>
      )}

      {catalog.length === 0 ? (
        <p className="text-sm text-pn-text-secondary bg-pn-bg-subtle border border-pn-border rounded-xl p-5">
          Noch keine Städte hinterlegt. Lege JSON-Dateien unter{" "}
          <code className="text-xs">data/location-areas/</code> ab (eine Datei pro Stadt).
        </p>
      ) : (
        <>
          <section className="bg-pn-bg-surface border border-pn-border rounded-xl p-5 space-y-4">
            <div>
              <h2 className="font-semibold mb-1">Stadt</h2>
              <p className="text-sm text-pn-text-secondary">
                Wähle die Stadt für dein Wunschgebiet.
              </p>
            </div>
            <label className="block">
              <span className="text-sm font-medium text-pn-text-secondary">Stadt</span>
              <select
                value={cityId}
                onChange={(e) => handleCityChange(e.target.value)}
                className="mt-1 w-full border border-pn-border rounded-lg px-3 py-2 text-sm bg-white"
                disabled={pending}
              >
                <option value="">— keine Auswahl —</option>
                {catalog.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </section>

          {city && (
            <>
              <section className="bg-pn-bg-surface border border-pn-border rounded-xl p-5 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold mb-1">Postleitzahlen</h2>
                    <p className="text-sm text-pn-text-secondary">
                      PLZ-Bereiche, die grundsätzlich in Frage kommen.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setAllPlz(true)}
                      disabled={pending}
                      className="text-xs px-2 py-1 border border-pn-border rounded-lg hover:bg-pn-bg-subtle disabled:opacity-50"
                    >
                      Alle
                    </button>
                    <button
                      type="button"
                      onClick={() => setAllPlz(false)}
                      disabled={pending}
                      className="text-xs px-2 py-1 border border-pn-border rounded-lg hover:bg-pn-bg-subtle disabled:opacity-50"
                    >
                      Keine
                    </button>
                  </div>
                </div>
                <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {city.postalCodes.map((entry) => (
                    <li key={entry.plz}>
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedPlz.includes(entry.plz)}
                          onChange={(e) => togglePlz(entry.plz, e.target.checked)}
                          disabled={pending}
                          className="rounded border-pn-border"
                        />
                        <span>{entry.plz}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </section>

              {selectedPlz.length > 0 && (
                <section className="bg-pn-bg-surface border border-pn-border rounded-xl p-5 space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="font-semibold mb-1">Stadtteile / Ortsteile</h2>
                      <p className="text-sm text-pn-text-secondary">
                        Aus den gewählten PLZ — feinere Eingrenzung nach Stadtteil.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setAllDistricts(true)}
                        disabled={pending}
                        className="text-xs px-2 py-1 border border-pn-border rounded-lg hover:bg-pn-bg-subtle disabled:opacity-50"
                      >
                        Alle
                      </button>
                      <button
                        type="button"
                        onClick={() => setAllDistricts(false)}
                        disabled={pending}
                        className="text-xs px-2 py-1 border border-pn-border rounded-lg hover:bg-pn-bg-subtle disabled:opacity-50"
                      >
                        Keine
                      </button>
                    </div>
                  </div>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {availableDistricts.map((district) => (
                      <li key={district}>
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedDistricts.includes(district)}
                            onChange={(e) => toggleDistrict(district, e.target.checked)}
                            disabled={pending}
                            className="rounded border-pn-border"
                          />
                          <span>{district}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={pending || catalog.length === 0 || (cityId !== "" && selectedPlz.length === 0)}
          className="bg-pn-accent text-white font-semibold px-4 py-2 rounded-lg text-sm disabled:opacity-50"
        >
          {pending ? "Speichern…" : "Speichern"}
        </button>
        {(cityId || selectedPlz.length > 0) && (
          <button
            type="button"
            onClick={handleClear}
            disabled={pending}
            className="bg-pn-bg-subtle border border-pn-border text-pn-text-primary font-medium px-4 py-2 rounded-lg text-sm hover:bg-pn-border/40 disabled:opacity-50"
          >
            Zurücksetzen
          </button>
        )}
      </div>

      <p className="text-xs text-pn-text-tertiary">
        Die Zuordnung erfolgt anhand der Adresse (PLZ und ggf. Stadtteil im Text). Kein Einfluss
        auf die Bewertung — nur Anzeige in der Liste, auf der Detailseite und auf der Karte.
      </p>
    </div>
  );
}
