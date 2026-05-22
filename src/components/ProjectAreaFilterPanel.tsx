"use client";

import { useMemo, useState, useTransition } from "react";
import {
  clearProjectAreaDistrictsAction,
  deleteProjectAreaDistrictAction,
  importProjectAreaDistrictsAction,
  searchOrteAction,
  updateProjectAreaFilterAction,
} from "@/app/actions";
import type { AreaFilterConfig, AreaFilterMode } from "@/lib/area-filter";
import {
  PLZ_MAP_CIRCLE_RADIUS_DEFAULT_M,
  PLZ_MAP_CIRCLE_RADIUS_MAX_M,
  PLZ_MAP_CIRCLE_RADIUS_MIN_M,
  areaFilterCircleRadiusM,
  areaFilterMode,
  areaFilterOrtKeys,
  areaFilterSectionTitle,
  defaultDistrictsForPlzSelection,
  districtsForPlzList,
  normalizePlzMapCircleRadiusM,
} from "@/lib/area-filter";
import { serializeProjectAreaDistrictsImport } from "@/lib/location-catalog-import";
import {
  findOrtByKey,
  formatOrtLabel,
  ortReferenceKey,
  type PlzReferenceOrt,
} from "@/lib/plz-reference";

type SavedConfig = {
  ortKey: string | null;
  config: AreaFilterConfig | null;
};

function resolveInitialOrte(initial: SavedConfig, initialOrt: PlzReferenceOrt | null): PlzReferenceOrt[] {
  const keys = areaFilterOrtKeys(initial.ortKey, initial.config);
  const orte = keys
    .map((key) => findOrtByKey(key))
    .filter((entry): entry is PlzReferenceOrt => entry != null);
  if (orte.length > 0) return orte;
  return initialOrt ? [initialOrt] : [];
}

function sortOrte(orte: PlzReferenceOrt[]): PlzReferenceOrt[] {
  return [...orte].sort((a, b) => a.name.localeCompare(b.name, "de"));
}

function buildImportTablesByOrt(
  orte: PlzReferenceOrt[],
  projectAreaDistricts: Record<string, string[]>
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const ort of orte) {
    const key = ortReferenceKey(ort.name, ort.bundesland);
    out[key] = serializeProjectAreaDistrictsImport(projectAreaDistricts, ort.name, ort.plz);
  }
  return out;
}

export function ProjectAreaFilterPanel({
  projectId,
  saved,
  error,
  districtsSaved,
  districtsCleared,
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
  districtsCleared?: boolean;
  districtsError?: string;
  initial: SavedConfig;
  initialOrt: PlzReferenceOrt | null;
  bundeslaender: string[];
  districtsByPlz: Record<string, string[]>;
  projectAreaDistricts: Record<string, string[]>;
}) {
  const initialOrte = resolveInitialOrte(initial, initialOrt);
  const [selectedOrte, setSelectedOrte] = useState<PlzReferenceOrt[]>(() => sortOrte(initialOrte));
  const [activeOrtKey, setActiveOrtKey] = useState<string | null>(() => {
    const first = initialOrte[0];
    return first ? ortReferenceKey(first.name, first.bundesland) : null;
  });
  const [selectedPlz, setSelectedPlz] = useState<string[]>(initial.config?.selectedPlz ?? []);
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>(
    initial.config?.selectedDistricts ?? []
  );
  const [bundeslandFilter, setBundeslandFilter] = useState(
    initialOrte[0]?.bundesland ?? initialOrt?.bundesland ?? ""
  );
  const [ortQuery, setOrtQuery] = useState("");
  const [ortResults, setOrtResults] = useState<PlzReferenceOrt[]>([]);
  const [importTablesByOrtKey, setImportTablesByOrtKey] = useState<Record<string, string>>(() =>
    buildImportTablesByOrt(initialOrte, projectAreaDistricts)
  );
  const [denyMode, setDenyMode] = useState(() => areaFilterMode(initial.config) === "deny");
  const [circleRadiusKm, setCircleRadiusKm] = useState(() => {
    const meters = areaFilterCircleRadiusM(initial.config);
    return Math.round(meters / 100) / 10;
  });
  const [pending, startTransition] = useTransition();

  const circleRadiusMinKm = PLZ_MAP_CIRCLE_RADIUS_MIN_M / 1000;
  const circleRadiusMaxKm = PLZ_MAP_CIRCLE_RADIUS_MAX_M / 1000;
  const circleRadiusDefaultKm = PLZ_MAP_CIRCLE_RADIUS_DEFAULT_M / 1000;

  const filterMode: AreaFilterMode = denyMode ? "deny" : "allow";
  const filterSectionTitle = areaFilterSectionTitle(filterMode);

  const activeOrt = useMemo(
    () =>
      selectedOrte.find((o) => ortReferenceKey(o.name, o.bundesland) === activeOrtKey) ?? null,
    [selectedOrte, activeOrtKey]
  );

  const selectedPlzForActiveOrtList = useMemo(
    () => (activeOrt ? selectedPlz.filter((plz) => activeOrt.plz.includes(plz)) : []),
    [activeOrt, selectedPlz]
  );

  const customDistrictsForActiveOrt = useMemo(() => {
    if (!activeOrt) return {};
    const out: Record<string, string[]> = {};
    for (const plz of activeOrt.plz) {
      if (projectAreaDistricts[plz]) out[plz] = projectAreaDistricts[plz];
    }
    return out;
  }, [activeOrt, projectAreaDistricts]);

  const hasCustomDistrictsForActiveOrt = Object.keys(customDistrictsForActiveOrt).length > 0;

  const activeImportTable = activeOrtKey ? (importTablesByOrtKey[activeOrtKey] ?? "") : "";

  const availableDistricts = useMemo(
    () => districtsForPlzList(districtsByPlz, selectedPlzForActiveOrtList),
    [districtsByPlz, selectedPlzForActiveOrtList]
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

  function addOrSelectOrt(next: PlzReferenceOrt) {
    const key = ortReferenceKey(next.name, next.bundesland);
    setSelectedOrte((prev) => {
      const exists = prev.some((o) => ortReferenceKey(o.name, o.bundesland) === key);
      return exists ? prev : sortOrte([...prev, next]);
    });
    setImportTablesByOrtKey((prev) =>
      prev[key] != null
        ? prev
        : {
            ...prev,
            [key]: serializeProjectAreaDistrictsImport(projectAreaDistricts, next.name, next.plz),
          }
    );
    setActiveOrtKey(key);
    setOrtQuery("");
    setOrtResults([]);
  }

  function removeOrt(key: string) {
    const ortToRemove = selectedOrte.find((o) => ortReferenceKey(o.name, o.bundesland) === key);
    const others = selectedOrte.filter((o) => ortReferenceKey(o.name, o.bundesland) !== key);
    if (ortToRemove) {
      const exclusivePlz = ortToRemove.plz.filter(
        (plz) => !others.some((o) => o.plz.includes(plz))
      );
      const nextPlz = selectedPlz.filter((plz) => !exclusivePlz.includes(plz));
      setSelectedPlz(nextPlz);
      setSelectedDistricts((prev) =>
        prev.filter((district) =>
          nextPlz.some((plz) => (districtsByPlz[plz] ?? []).includes(district))
        )
      );
    }
    setSelectedOrte(sortOrte(others));
    setImportTablesByOrtKey((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setActiveOrtKey(
      others[0] ? ortReferenceKey(others[0].name, others[0].bundesland) : null
    );
  }

  function updateActiveImportTable(value: string) {
    if (!activeOrtKey) return;
    setImportTablesByOrtKey((prev) => ({ ...prev, [activeOrtKey]: value }));
  }

  function activeOrtPlzScope(): string {
    return activeOrt?.plz.join(",") ?? "";
  }

  function togglePlz(plz: string, checked: boolean) {
    const nextPlz = checked
      ? [...selectedPlz, plz].sort()
      : selectedPlz.filter((p) => p !== plz);

    let nextDistricts = selectedDistricts.filter((d) => {
      if (!checked && plz) {
        const stillCovered = nextPlz.some((p) => (districtsByPlz[p] ?? []).includes(d));
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

  function setAllPlzForActiveOrt(all: boolean) {
    if (!activeOrt) return;
    const ortPlz = activeOrt.plz;
    if (all) {
      const nextPlz = [...new Set([...selectedPlz, ...ortPlz])].sort();
      setSelectedPlz(nextPlz);
      setSelectedDistricts(defaultDistrictsForPlzSelection(districtsByPlz, nextPlz));
      return;
    }
    const exclusivePlz = ortPlz.filter(
      (plz) => !selectedOrte.some(
        (o) =>
          ortReferenceKey(o.name, o.bundesland) !== activeOrtKey &&
          o.plz.includes(plz)
      )
    );
    const nextPlz = selectedPlz.filter((plz) => !exclusivePlz.includes(plz));
    setSelectedPlz(nextPlz);
    setSelectedDistricts((prev) =>
      prev.filter((district) => {
        const stillCovered = nextPlz.some((p) => (districtsByPlz[p] ?? []).includes(district));
        return stillCovered;
      })
    );
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

  function circleRadiusMFromKm(km: number): number {
    return normalizePlzMapCircleRadiusM(Math.round(km * 1000));
  }

  function handleSave() {
    run(async () => {
      await updateProjectAreaFilterAction(projectId, {
        ortKeys: selectedOrte.map((o) => ortReferenceKey(o.name, o.bundesland)),
        selectedPlz,
        selectedDistricts,
        mode: filterMode,
        circleRadiusM: circleRadiusMFromKm(circleRadiusKm),
      });
    });
  }

  function handleClear() {
    setSelectedOrte([]);
    setActiveOrtKey(null);
    setOrtQuery("");
    setSelectedPlz([]);
    setSelectedDistricts([]);
    setCircleRadiusKm(circleRadiusDefaultKm);
    setImportTablesByOrtKey({});
    run(async () => {
      await updateProjectAreaFilterAction(projectId, {
        ortKeys: [],
        selectedPlz: [],
        selectedDistricts: [],
      });
    });
  }

  const selectedPlzForActiveOrt = activeOrt
    ? selectedPlz.filter((plz) => activeOrt.plz.includes(plz)).length
    : 0;

  return (
    <div className="space-y-6 max-w-2xl">
      {(saved || districtsSaved) && (
        <p className="text-sm text-pn-score-high bg-pn-score-high-bg px-3 py-2 rounded-lg">
          {saved
            ? `${filterSectionTitle} wurde gespeichert.`
            : districtsCleared
              ? "Optionale Ortsteile wurden entfernt."
              : "Ortsteile wurden übernommen."}
        </p>
      )}
      {error === "ort" && (
        <p className="text-sm text-pn-score-low bg-pn-score-low-bg px-3 py-2 rounded-lg">
          Bitte mindestens einen Ort auswählen und pro Ort mindestens eine PLZ ankreuzen.
        </p>
      )}
      {districtsError === "import" && (
        <p className="text-sm text-pn-score-low bg-pn-score-low-bg px-3 py-2 rounded-lg">
          Import fehlgeschlagen. Bitte mindestens eine Zeile mit PLZ und Ortsteilen angeben.
        </p>
      )}

      <section className="bg-pn-bg-surface border border-pn-border rounded-xl p-5 space-y-4">
        <div>
          <h3 className="font-semibold mb-1">Modus</h3>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={denyMode}
              onChange={(e) => setDenyMode(e.target.checked)}
              disabled={pending}
              className="mt-1 rounded border-pn-border"
            />
            <span>
              <span className="text-sm font-medium text-pn-text-primary block">
                Als NoGo-Zone verwenden
              </span>
              <span className="text-sm text-pn-text-secondary">
                {denyMode
                  ? "Immobilien in den gewählten PLZ/Ortsteilen werden rot markiert (ausgeschlossenes Gebiet)."
                  : "Immobilien in den gewählten PLZ/Ortsteilen werden grün markiert (Wunschgebiet)."}
              </span>
            </span>
          </label>
        </div>
      </section>

      <section className="bg-pn-bg-surface border border-pn-border rounded-xl p-5 space-y-3">
        <div>
          <h3 className="font-semibold mb-1">Kartenradius</h3>
          <p className="text-sm text-pn-text-secondary">
            Größe der Kreise auf der Karte für die gewählten PLZ. Standard: {circleRadiusDefaultKm}{" "}
            km.
          </p>
        </div>
        <label className="block">
          <span className="text-sm font-medium text-pn-text-secondary">Radius</span>
          <div className="mt-1 flex items-center gap-2">
            <input
              type="number"
              min={circleRadiusMinKm}
              max={circleRadiusMaxKm}
              step={0.1}
              value={circleRadiusKm}
              onChange={(e) => {
                const parsed = Number.parseFloat(e.target.value);
                if (!Number.isFinite(parsed)) return;
                setCircleRadiusKm(
                  Math.min(circleRadiusMaxKm, Math.max(circleRadiusMinKm, parsed))
                );
              }}
              disabled={pending}
              className="w-28 border border-pn-border rounded-lg px-3 py-2 text-sm"
            />
            <span className="text-sm text-pn-text-secondary">km</span>
            <button
              type="button"
              disabled={pending || circleRadiusKm === circleRadiusDefaultKm}
              onClick={() => setCircleRadiusKm(circleRadiusDefaultKm)}
              className="text-xs px-2 py-1 border border-pn-border rounded-lg hover:bg-pn-bg-subtle disabled:opacity-50"
            >
              Standard
            </button>
          </div>
        </label>
      </section>

      <section className="bg-pn-bg-surface border border-pn-border rounded-xl p-5 space-y-4">
        <div>
          <h3 className="font-semibold mb-1">Orte wählen</h3>
          <p className="text-sm text-pn-text-secondary">
            Mehrere Städte möglich (z. B. Hamburg und Berlin). Alle PLZ in Deutschland sind
            hinterlegt ({bundeslaender.length} Bundesländer).
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
            <span className="text-sm font-medium text-pn-text-secondary">Ort hinzufügen</span>
            <input
              value={ortQuery}
              onChange={(e) => void handleOrtQueryChange(e.target.value)}
              placeholder="z. B. Hamburg, Berlin, Bremen"
              disabled={pending}
              className="mt-1 w-full border border-pn-border rounded-lg px-3 py-2 text-sm"
            />
          </label>
          {ortResults.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full max-h-48 overflow-auto bg-white border border-pn-border rounded-lg shadow-lg">
              {ortResults.map((entry) => {
                const key = ortReferenceKey(entry.name, entry.bundesland);
                const alreadyAdded = selectedOrte.some(
                  (o) => ortReferenceKey(o.name, o.bundesland) === key
                );
                return (
                  <li key={key}>
                    <button
                      type="button"
                      onClick={() => addOrSelectOrt(entry)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-pn-bg-subtle"
                    >
                      {formatOrtLabel(entry)}
                      <span className="text-pn-text-tertiary ml-2">
                        ({entry.plz.length} PLZ)
                        {alreadyAdded ? " · bereits hinzugefügt" : ""}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {selectedOrte.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedOrte.map((entry) => {
              const key = ortReferenceKey(entry.name, entry.bundesland);
              const plzCount = selectedPlz.filter((plz) => entry.plz.includes(plz)).length;
              const isActive = key === activeOrtKey;
              return (
                <span
                  key={key}
                  className={`inline-flex items-center gap-1 text-sm border rounded-full pl-3 pr-1 py-1 ${
                    isActive
                      ? "border-pn-accent bg-pn-accent/10 text-pn-accent"
                      : "border-pn-border bg-pn-bg-subtle"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setActiveOrtKey(key)}
                    disabled={pending}
                    className="font-medium"
                  >
                    {entry.name}
                    <span className="text-pn-text-tertiary font-normal ml-1">
                      ({plzCount}/{entry.plz.length} PLZ)
                    </span>
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => removeOrt(key)}
                    className="px-1.5 text-pn-text-tertiary hover:text-pn-score-low"
                    aria-label={`${entry.name} entfernen`}
                  >
                    ×
                  </button>
                </span>
              );
            })}
          </div>
        )}
      </section>

      {activeOrt && (
        <>
          <section className="bg-pn-bg-surface border border-pn-border rounded-xl p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold mb-1">Postleitzahlen</h3>
                <p className="text-sm text-pn-text-secondary">
                  PLZ für {formatOrtLabel(activeOrt)} ({selectedPlzForActiveOrt} von{" "}
                  {activeOrt.plz.length} gewählt).
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAllPlzForActiveOrt(true)}
                  disabled={pending}
                  className="text-xs px-2 py-1 border border-pn-border rounded-lg hover:bg-pn-bg-subtle disabled:opacity-50"
                >
                  Alle
                </button>
                <button
                  type="button"
                  onClick={() => setAllPlzForActiveOrt(false)}
                  disabled={pending}
                  className="text-xs px-2 py-1 border border-pn-border rounded-lg hover:bg-pn-bg-subtle disabled:opacity-50"
                >
                  Keine
                </button>
              </div>
            </div>
            <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-64 overflow-auto">
              {activeOrt.plz.map((plz) => (
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

          {selectedPlzForActiveOrtList.length > 0 && hasDistricts && (
            <section className="bg-pn-bg-surface border border-pn-border rounded-xl p-5 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold mb-1">Stadtteile / Ortsteile</h3>
                  <p className="text-sm text-pn-text-secondary">
                    Feinere Eingrenzung für {formatOrtLabel(activeOrt)} (
                    {selectedPlzForActiveOrtList.length} PLZ gewählt).
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

          {selectedPlzForActiveOrtList.length > 0 && !hasDistricts && (
            <p className="text-sm text-pn-text-secondary bg-pn-bg-subtle border border-pn-border rounded-lg px-3 py-2">
              Für die gewählten PLZ in {formatOrtLabel(activeOrt)} liegen keine Ortsteile vor —
              die ganze PLZ gilt als {denyMode ? "NoGo-Zone" : "Wunschgebiet"}. Du kannst unten fehlende Ortsteile ergänzen.
            </p>
          )}

          <details
            className="bg-pn-bg-subtle border border-pn-border rounded-xl p-4"
            open={hasCustomDistrictsForActiveOrt}
          >
            <summary className="cursor-pointer text-sm font-medium text-pn-text-secondary">
              Optionale Ortsteile für {activeOrt.name}{" "}
              {hasCustomDistrictsForActiveOrt
                ? `(${Object.values(customDistrictsForActiveOrt).flat().length})`
                : ""}
            </summary>
            <div className="mt-4 space-y-4">
              <p className="text-xs text-pn-text-tertiary">
                Ergänzungen zu den hinterlegten OSM-Ortsteilen nur für {activeOrt.name}. Text
                bearbeiten und übernehmen — leerer Inhalt entfernt nur die optionalen Einträge
                dieser Stadt.
              </p>
              <form
                className="space-y-3"
                data-unsaved-track
                data-unsaved-label={`Ortsteile ${activeOrt.name}`}
                onSubmit={(e) => {
                  e.preventDefault();
                  run(async () => {
                    await importProjectAreaDistrictsAction(
                      projectId,
                      activeImportTable,
                      activeOrtPlzScope()
                    );
                  });
                }}
              >
                <textarea
                  name="importTable"
                  value={activeImportTable}
                  onChange={(e) => updateActiveImportTable(e.target.value)}
                  placeholder={`20095 | Hamburg | Altstadt, Neustadt\n20359 | Hamburg | St. Pauli, Sternschanze`}
                  disabled={pending}
                  rows={8}
                  className="border border-pn-border rounded-lg px-3 py-2 text-sm w-full font-mono"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={pending}
                    className="bg-pn-accent text-white font-medium px-4 py-2 rounded-lg text-sm disabled:opacity-50"
                  >
                    {pending ? "Speichern…" : "Ortsteile übernehmen"}
                  </button>
                  {hasCustomDistrictsForActiveOrt && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        run(async () => {
                          await clearProjectAreaDistrictsAction(projectId, activeOrtPlzScope());
                          updateActiveImportTable("");
                        })
                      }
                      className="border border-pn-border bg-pn-bg-surface text-pn-text-primary font-medium px-4 py-2 rounded-lg text-sm hover:bg-pn-bg-subtle disabled:opacity-50"
                    >
                      Für {activeOrt.name} entfernen
                    </button>
                  )}
                </div>
              </form>
              {hasCustomDistrictsForActiveOrt && (
                <ul className="space-y-2">
                  {Object.entries(customDistrictsForActiveOrt)
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
                              onClick={() => {
                                if (
                                  !window.confirm(
                                    `„${district}" (${plz}) wirklich aus dem Wunschgebiet entfernen?`
                                  )
                                ) {
                                  return;
                                }
                                run(async () => {
                                  await deleteProjectAreaDistrictAction(
                                    projectId,
                                    plz,
                                    district
                                  );
                                });
                              }}
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
          disabled={pending || selectedOrte.length === 0 || selectedPlz.length === 0}
          className="bg-pn-accent text-white font-semibold px-4 py-2 rounded-lg text-sm disabled:opacity-50"
        >
          {pending ? "Speichern…" : `${filterSectionTitle} speichern`}
        </button>
        {(selectedOrte.length > 0 || selectedPlz.length > 0) && (
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
