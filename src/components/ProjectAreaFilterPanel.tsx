"use client";

import { useMemo, useState, useTransition } from "react";
import {
  deleteProjectAreaDistrictAction,
  importProjectAreaDistrictsAction,
  searchOrteAction,
  updateProjectAreaFilterAction,
} from "@/app/actions";
import type { AreaFilterConfig } from "@/lib/area-filter";
import {
  defaultDistrictsForPlzSelection,
  districtsForPlzList,
} from "@/lib/area-filter";
import {
  formatOrtLabel,
  ortReferenceKey,
  type PlzReferenceOrt,
} from "@/lib/plz-reference";

type SavedConfig = {
  ortKey: string | null;
  config: AreaFilterConfig | null;
};

export function ProjectAreaFilterPanel({
  projectId,
  saved,
  error,
  districtsSaved,
  districtsError,
  initial,
  initialOrt,
  bundeslaender,
  districtsByPlz,
  projectAreaDistricts,
}: {
  projectId: string;
  saved?: boolean;
  error?: string;
  districtsSaved?: boolean;
  districtsError?: string;
  initial: SavedConfig;
  initialOrt: PlzReferenceOrt | null;
  bundeslaender: string[];
  districtsByPlz: Record<string, string[]>;
  projectAreaDistricts: Record<string, string[]>;
}) {
  const [ort, setOrt] = useState<PlzReferenceOrt | null>(initialOrt);
  const [selectedPlz, setSelectedPlz] = useState<string[]>(initial.config?.selectedPlz ?? []);
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>(
    initial.config?.selectedDistricts ?? []
  );
  const [bundeslandFilter, setBundeslandFilter] = useState(initialOrt?.bundesland ?? "");
  const [ortQuery, setOrtQuery] = useState(initialOrt ? formatOrtLabel(initialOrt) : "");
  const [ortResults, setOrtResults] = useState<PlzReferenceOrt[]>([]);
  const [importTable, setImportTable] = useState("");
  const [pending, startTransition] = useTransition();

  const availableDistricts = useMemo(
    () => districtsForPlzList(districtsByPlz, selectedPlz),
    [districtsByPlz, selectedPlz]
  );

  const hasDistricts = availableDistricts.length > 0;

  function run(action: () => Promise<void>) {
    startTransition(() => {
      void action();
    });
  }

  async function handleOrtQueryChange(value: string) {
    setOrtQuery(value);
    if (value.trim().length < 2) {
      setOrtResults([]);
      return;
    }
    const results = await searchOrteAction(value, bundeslandFilter || undefined);
    setOrtResults(results);
  }

  function selectOrt(next: PlzReferenceOrt) {
    setOrt(next);
    setOrtQuery(formatOrtLabel(next));
    setOrtResults([]);
    setSelectedPlz([]);
    setSelectedDistricts([]);
  }

  function togglePlz(plz: string, checked: boolean) {
    const nextPlz = checked
      ? [...selectedPlz, plz].sort()
      : selectedPlz.filter((p) => p !== plz);

    let nextDistricts = selectedDistricts.filter((d) => {
      if (!checked && plz) {
        const stillCovered = nextPlz.some((p) =>
          (districtsByPlz[p] ?? []).includes(d)
        );
        return stillCovered;
      }
      return true;
    });

    if (checked) {
      const newDistricts = defaultDistrictsForPlzSelection(districtsByPlz, [plz]);
      nextDistricts = [...new Set([...nextDistricts, ...newDistricts])].sort((a, b) =>
        a.localeCompare(b, "de")
      );
    }

    setSelectedPlz(nextPlz);
    setSelectedDistricts(nextDistricts);
  }

  function setAllPlz(all: boolean) {
    if (!ort) return;
    const plzList = all ? ort.plz : [];
    setSelectedPlz(plzList);
    setSelectedDistricts(all ? defaultDistrictsForPlzSelection(districtsByPlz, plzList) : []);
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
    run(async () => {
      await updateProjectAreaFilterAction(projectId, {
        ortKey: ort ? ortReferenceKey(ort.name, ort.bundesland) : null,
        selectedPlz,
        selectedDistricts,
      });
    });
  }

  function handleClear() {
    setOrt(null);
    setOrtQuery("");
    setSelectedPlz([]);
    setSelectedDistricts([]);
    run(async () => {
      await updateProjectAreaFilterAction(projectId, {
        ortKey: null,
        selectedPlz: [],
        selectedDistricts: [],
      });
    });
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {(saved || districtsSaved) && (
        <p className="text-sm text-pn-score-high bg-pn-score-high-bg px-3 py-2 rounded-lg">
          {saved ? "Wunschgebiet wurde gespeichert." : "Ortsteile wurden importiert."}
        </p>
      )}
      {error === "ort" && (
        <p className="text-sm text-pn-score-low bg-pn-score-low-bg px-3 py-2 rounded-lg">
          Bitte einen Ort auswählen und mindestens eine PLZ ankreuzen.
        </p>
      )}
      {districtsError === "import" && (
        <p className="text-sm text-pn-score-low bg-pn-score-low-bg px-3 py-2 rounded-lg">
          Import fehlgeschlagen. Bitte mindestens eine Zeile mit PLZ und Ortsteilen angeben.
        </p>
      )}

      <section className="bg-pn-bg-surface border border-pn-border rounded-xl p-5 space-y-4">
        <div>
          <h3 className="font-semibold mb-1">Ort wählen</h3>
          <p className="text-sm text-pn-text-secondary">
            Alle PLZ in Deutschland sind hinterlegt ({bundeslaender.length} Bundesländer). Suche
            deinen Wunschort.
          </p>
        </div>

        <label className="block">
          <span className="text-sm font-medium text-pn-text-secondary">Bundesland (optional)</span>
          <select
            value={bundeslandFilter}
            onChange={(e) => setBundeslandFilter(e.target.value)}
            className="mt-1 w-full border border-pn-border rounded-lg px-3 py-2 text-sm bg-white"
            disabled={pending}
          >
            <option value="">— Alle —</option>
            {bundeslaender.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </label>

        <div className="relative">
          <label className="block">
            <span className="text-sm font-medium text-pn-text-secondary">Ort</span>
            <input
              value={ortQuery}
              onChange={(e) => void handleOrtQueryChange(e.target.value)}
              placeholder="z. B. Bremen, München, Köln"
              disabled={pending}
              className="mt-1 w-full border border-pn-border rounded-lg px-3 py-2 text-sm"
            />
          </label>
          {ortResults.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full max-h-48 overflow-auto bg-white border border-pn-border rounded-lg shadow-lg">
              {ortResults.map((entry) => (
                <li key={ortReferenceKey(entry.name, entry.bundesland)}>
                  <button
                    type="button"
                    onClick={() => selectOrt(entry)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-pn-bg-subtle"
                  >
                    {formatOrtLabel(entry)}
                    <span className="text-pn-text-tertiary ml-2">({entry.plz.length} PLZ)</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {ort && (
        <>
          <section className="bg-pn-bg-surface border border-pn-border rounded-xl p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold mb-1">Postleitzahlen</h3>
                <p className="text-sm text-pn-text-secondary">
                  PLZ für {formatOrtLabel(ort)}.
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
            <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-64 overflow-auto">
              {ort.plz.map((plz) => (
                <li key={plz}>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedPlz.includes(plz)}
                      onChange={(e) => togglePlz(plz, e.target.checked)}
                      disabled={pending}
                      className="rounded border-pn-border"
                    />
                    <span>{plz}</span>
                  </label>
                </li>
              ))}
            </ul>
          </section>

          {selectedPlz.length > 0 && hasDistricts && (
            <section className="bg-pn-bg-surface border border-pn-border rounded-xl p-5 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold mb-1">Stadtteile / Ortsteile</h3>
                  <p className="text-sm text-pn-text-secondary">
                    Feinere Eingrenzung für die gewählten PLZ.
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

          {selectedPlz.length > 0 && !hasDistricts && (
            <p className="text-sm text-pn-text-secondary bg-pn-bg-subtle border border-pn-border rounded-lg px-3 py-2">
              Für diese PLZ liegen keine Ortsteile vor — die ganze PLZ gilt als Wunschgebiet. Du
              kannst unten fehlende Ortsteile ergänzen.
            </p>
          )}

          <details className="bg-pn-bg-subtle border border-pn-border rounded-xl p-4">
            <summary className="cursor-pointer text-sm font-medium text-pn-text-secondary">
              Fehlende Ortsteile ergänzen (optional)
            </summary>
            <div className="mt-4 space-y-4">
              <p className="text-xs text-pn-text-tertiary">
                Nur nötig, wenn die hinterlegten OSM-Ortsteile unvollständig sind oder andere
                Bezeichnungen verwenden.
              </p>
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  run(async () => {
                    await importProjectAreaDistrictsAction(projectId, importTable);
                    setImportTable("");
                  });
                }}
              >
                <textarea
                  value={importTable}
                  onChange={(e) => setImportTable(e.target.value)}
                  placeholder={`28203 | Bremen | Fesenfeld, Ostertor, Steintor\n28205 | Bremen | Findorff, Walle`}
                  disabled={pending}
                  rows={6}
                  className="border border-pn-border rounded-lg px-3 py-2 text-sm w-full font-mono text-xs"
                />
                <button
                  type="submit"
                  disabled={pending || !importTable.trim()}
                  className="bg-pn-accent text-white font-medium px-4 py-2 rounded-lg text-sm disabled:opacity-50"
                >
                  Ortsteile importieren
                </button>
              </form>
              {Object.keys(projectAreaDistricts).length > 0 && (
                <ul className="space-y-2">
                  {Object.entries(projectAreaDistricts)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([plz, districts]) => (
                      <li key={plz} className="text-sm">
                        <span className="font-medium">{plz}:</span>{" "}
                        {districts.map((district) => (
                          <span
                            key={district}
                            className="inline-flex items-center gap-1 mr-2 text-xs bg-pn-bg-surface border border-pn-border rounded-full px-2 py-0.5"
                          >
                            {district}
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() =>
                                run(async () => {
                                  await deleteProjectAreaDistrictAction(
                                    projectId,
                                    plz,
                                    district
                                  );
                                })
                              }
                              className="text-pn-text-tertiary hover:text-pn-score-low"
                              aria-label={`${district} entfernen`}
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </li>
                    ))}
                </ul>
              )}
            </div>
          </details>
        </>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={pending || !ort || selectedPlz.length === 0}
          className="bg-pn-accent text-white font-semibold px-4 py-2 rounded-lg text-sm disabled:opacity-50"
        >
          {pending ? "Speichern…" : "Wunschgebiet speichern"}
        </button>
        {(ort || selectedPlz.length > 0) && (
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
        PLZ-Daten: OpenStreetMap / suche-postleitzahl.org · Ortsteile: OpenStreetMap / OpenPLZ
        (ODbL). Zuordnung anhand der Adresse — kein Einfluss auf die Bewertung.
      </p>
    </div>
  );
}
