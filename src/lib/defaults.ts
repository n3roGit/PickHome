export type DefaultCriterion = { name: string; weight: number; isDealbreaker?: boolean };

export type DefaultGroup = { name: string; criteria: DefaultCriterion[] };

export const DEFAULT_CRITERIA_GROUPS: DefaultGroup[] = [
  {
    name: "Allgemein",
    criteria: [
      { name: "Kaufpreis", weight: 5, isDealbreaker: true },
      { name: "Miete", weight: 3 },
      { name: "Betriebskosten", weight: 3 },
      { name: "Wohnfläche", weight: 4 },
      { name: "Haus oder Wohnung", weight: 3 },
      { name: "Zustand", weight: 4 },
      { name: "Grundstücksfläche", weight: 3 },
      { name: "Grundriss", weight: 4 },
      { name: "Gebäudequalität", weight: 3 },
      { name: "Raumanzahl", weight: 3 },
    ],
  },
  {
    name: "Gefühl",
    criteria: [{ name: "Wohngefühl", weight: 5 }],
  },
  {
    name: "Lage",
    criteria: [
      { name: "Stadtteil", weight: 4 },
      { name: "Arbeitsweg", weight: 5 },
      { name: "Umgebung & Schule", weight: 3 },
      { name: "ÖPNV", weight: 4 },
      { name: "Einkaufen", weight: 3 },
      { name: "Sonneneinstrahlung", weight: 3 },
      { name: "Fluglärm", weight: 4, isDealbreaker: true },
      { name: "Zuglärm", weight: 3 },
      { name: "Straßenlärm", weight: 3 },
    ],
  },
  {
    name: "Technik",
    criteria: [
      { name: "Heizung", weight: 3 },
      { name: "Energieklasse", weight: 3 },
      { name: "Solaranlage", weight: 2 },
      { name: "Elektrik", weight: 3 },
      { name: "FI-Schutz", weight: 2 },
    ],
  },
  {
    name: "Raumaufteilung",
    criteria: [
      { name: "Schlafzimmer", weight: 3 },
      { name: "Wohnzimmer", weight: 4 },
      { name: "Arbeitszimmer", weight: 3 },
      { name: "Küche", weight: 4 },
      { name: "Badezimmer", weight: 3 },
    ],
  },
  {
    name: "Außenbereich",
    criteria: [
      { name: "Garten / Balkon", weight: 4 },
      { name: "Aussicht", weight: 3 },
      { name: "Außenfassade", weight: 2 },
    ],
  },
  {
    name: "Komfort",
    criteria: [
      { name: "Garage / Stellplatz", weight: 3 },
      { name: "Fenster", weight: 2 },
      { name: "Stauraum", weight: 3 },
      { name: "Nachbarschaft", weight: 3 },
    ],
  },
];

/** Criterion names to enable on the viewing checklist when a project is created. */
export const DEFAULT_CHECKLIST_CRITERION_NAMES = new Set([
  "Kaufpreis",
  "Wohnfläche",
  "Zustand",
  "Haus oder Wohnung",
  "Stadtteil",
  "Arbeitsweg",
  "ÖPNV",
  "Heizung",
  "Energieklasse",
  "Elektrik",
  "Schlafzimmer",
  "Wohnzimmer",
  "Küche",
  "Badezimmer",
  "Garten / Balkon",
  "Garage / Stellplatz",
]);
