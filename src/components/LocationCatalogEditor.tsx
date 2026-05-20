"use client";

import { useMemo, useState, useTransition } from "react";
import {
  addLocationDistrictAction,
  addLocationPostalCodeAction,
  createLocationCityAction,
  deleteLocationCityAction,
  deleteLocationDistrictAction,
  deleteLocationPostalCodeAction,
} from "@/app/actions";
import type { LocationCity } from "@/lib/location-areas";

export function LocationCatalogEditor({
  projectId,
  catalog,
  saved,
  error,
}: {
  projectId: string;
  catalog: LocationCity[];
  saved?: boolean;
  error?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [expandedCityId, setExpandedCityId] = useState(catalog[0]?.id ?? "");
  const [newCityName, setNewCityName] = useState("");
  const [newPlz, setNewPlz] = useState("");
  const [newPlzDistricts, setNewPlzDistricts] = useState("");
  const [newDistrictByPlz, setNewDistrictByPlz] = useState<Record<string, string>>({});

  const expandedCity = useMemo(
    () => catalog.find((c) => c.id === expandedCityId) ?? null,
    [catalog, expandedCityId]
  );

  function run(action: () => Promise<void>) {
    startTransition(() => {
      void action();
    });
  }

  return (
    <div className="space-y-4 max-w-2xl">
      {saved && (
        <p className="text-sm text-pn-score-high bg-pn-score-high-bg px-3 py-2 rounded-lg">
          Gebietsdaten wurden gespeichert.
        </p>
      )}
      {error === "name" && (
        <p className="text-sm text-pn-score-low bg-pn-score-low-bg px-3 py-2 rounded-lg">
          Bitte einen Stadtnamen angeben.
        </p>
      )}
      {error === "plz" && (
        <p className="text-sm text-pn-score-low bg-pn-score-low-bg px-3 py-2 rounded-lg">
          Bitte eine gültige 5-stellige PLZ angeben.
        </p>
      )}
      {error === "district" && (
        <p className="text-sm text-pn-score-low bg-pn-score-low-bg px-3 py-2 rounded-lg">
          Bitte mindestens einen Stadtteil angeben.
        </p>
      )}

      <section className="bg-pn-bg-surface border border-pn-border rounded-xl p-5 space-y-4">
        <div>
          <h3 className="font-semibold mb-1">Stadt anlegen</h3>
          <p className="text-sm text-pn-text-secondary">
            Lege zuerst eine Stadt an, dann PLZ und Ortsteile.
          </p>
        </div>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const name = newCityName.trim();
            if (!name) return;
            run(async () => {
              await createLocationCityAction(projectId, name);
              setNewCityName("");
            });
          }}
        >
          <input
            value={newCityName}
            onChange={(e) => setNewCityName(e.target.value)}
            placeholder="z. B. Bremen"
            disabled={pending}
            className="border border-pn-border rounded-lg px-3 py-2 text-sm flex-1 min-w-[160px]"
          />
          <button
            type="submit"
            disabled={pending || !newCityName.trim()}
            className="bg-pn-accent text-white font-medium px-4 py-2 rounded-lg text-sm disabled:opacity-50"
          >
            Stadt anlegen
          </button>
        </form>
      </section>

      {catalog.length > 0 && (
        <section className="bg-pn-bg-surface border border-pn-border rounded-xl p-5 space-y-4">
          <div>
            <h3 className="font-semibold mb-1">Städte verwalten</h3>
            <p className="text-sm text-pn-text-secondary">
              PLZ und Ortsteile pro Stadt pflegen.
            </p>
          </div>

          <label className="block">
            <span className="text-sm font-medium text-pn-text-secondary">Stadt bearbeiten</span>
            <select
              value={expandedCityId}
              onChange={(e) => setExpandedCityId(e.target.value)}
              disabled={pending}
              className="mt-1 w-full border border-pn-border rounded-lg px-3 py-2 text-sm bg-white"
            >
              {catalog.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name}
                </option>
              ))}
            </select>
          </label>

          {expandedCity && (
            <div className="space-y-4 border-t border-pn-border pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{expandedCity.name}</p>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    run(async () => {
                      await deleteLocationCityAction(projectId, expandedCity.id);
                    })
                  }
                  className="text-xs text-pn-score-low hover:underline disabled:opacity-50"
                >
                  Stadt löschen
                </button>
              </div>

              <form
                className="space-y-3 bg-pn-bg-subtle rounded-lg p-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  run(async () => {
                    await addLocationPostalCodeAction(
                      projectId,
                      expandedCity.id,
                      newPlz,
                      newPlzDistricts
                    );
                    setNewPlz("");
                    setNewPlzDistricts("");
                  });
                }}
              >
                <p className="text-sm font-medium">PLZ hinzufügen</p>
                <input
                  value={newPlz}
                  onChange={(e) => setNewPlz(e.target.value)}
                  placeholder="28203"
                  disabled={pending}
                  className="border border-pn-border rounded-lg px-3 py-2 text-sm w-full max-w-[140px]"
                />
                <textarea
                  value={newPlzDistricts}
                  onChange={(e) => setNewPlzDistricts(e.target.value)}
                  placeholder="Ortsteile, kommagetrennt — z. B. Fesenfeld, Ostertor, Steintor"
                  disabled={pending}
                  rows={2}
                  className="border border-pn-border rounded-lg px-3 py-2 text-sm w-full"
                />
                <button
                  type="submit"
                  disabled={pending || !newPlz.trim() || !newPlzDistricts.trim()}
                  className="bg-pn-bg-surface border border-pn-border text-pn-text-primary font-medium px-3 py-1.5 rounded-lg text-sm hover:bg-pn-border/40 disabled:opacity-50"
                >
                  PLZ speichern
                </button>
              </form>

              {expandedCity.postalCodes.length === 0 ? (
                <p className="text-sm text-pn-text-tertiary">Noch keine PLZ für diese Stadt.</p>
              ) : (
                <ul className="space-y-4">
                  {expandedCity.postalCodes.map((entry) => (
                    <li
                      key={entry.plz}
                      className="border border-pn-border rounded-lg p-4 space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">{entry.plz}</span>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() =>
                            run(async () => {
                              await deleteLocationPostalCodeAction(
                                projectId,
                                expandedCity.id,
                                entry.plz
                              );
                            })
                          }
                          className="text-xs text-pn-score-low hover:underline disabled:opacity-50"
                        >
                          PLZ entfernen
                        </button>
                      </div>
                      <ul className="flex flex-wrap gap-2">
                        {entry.districts.map((district) => (
                          <li
                            key={district}
                            className="inline-flex items-center gap-1 text-xs bg-pn-bg-subtle border border-pn-border rounded-full px-2 py-1"
                          >
                            <span>{district}</span>
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() =>
                                run(async () => {
                                  await deleteLocationDistrictAction(
                                    projectId,
                                    expandedCity.id,
                                    entry.plz,
                                    district
                                  );
                                })
                              }
                              className="text-pn-text-tertiary hover:text-pn-score-low"
                              aria-label={`${district} entfernen`}
                            >
                              ×
                            </button>
                          </li>
                        ))}
                      </ul>
                      <form
                        className="flex flex-wrap gap-2"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const name = (newDistrictByPlz[entry.plz] ?? "").trim();
                          if (!name) return;
                          run(async () => {
                            await addLocationDistrictAction(
                              projectId,
                              expandedCity.id,
                              entry.plz,
                              name
                            );
                            setNewDistrictByPlz((prev) => ({ ...prev, [entry.plz]: "" }));
                          });
                        }}
                      >
                        <input
                          value={newDistrictByPlz[entry.plz] ?? ""}
                          onChange={(e) =>
                            setNewDistrictByPlz((prev) => ({
                              ...prev,
                              [entry.plz]: e.target.value,
                            }))
                          }
                          placeholder="Ortsteil hinzufügen"
                          disabled={pending}
                          className="border border-pn-border rounded-lg px-3 py-1.5 text-sm flex-1 min-w-[160px]"
                        />
                        <button
                          type="submit"
                          disabled={pending || !(newDistrictByPlz[entry.plz] ?? "").trim()}
                          className="text-sm text-pn-accent font-medium hover:underline disabled:opacity-50"
                        >
                          Hinzufügen
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
