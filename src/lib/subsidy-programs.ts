export type SubsidyProgramKind = "credit" | "grant" | "research";

export type SubsidyProgramId =
  | "kfw-124"
  | "kfw-300"
  | "kfw-297"
  | "kfw-298"
  | "kfw-261"
  | "kfw-458"
  | "bafa-beg-em"
  | "regional-fdb";

export type SubsidyProgram = {
  id: SubsidyProgramId;
  name: string;
  kind: SubsidyProgramKind;
  provider: string;
  summary: string;
  maxFundingLabel: string;
  url: string;
  applicabilityNotes: string;
  requires: string[];
};

export const SUBSIDY_PROGRAMS: Record<SubsidyProgramId, SubsidyProgram> = {
  "kfw-124": {
    id: "kfw-124",
    name: "KfW 124 – Wohneigentumsprogramm",
    kind: "credit",
    provider: "KfW",
    summary: "Zinsgünstiger Förderkredit für Kauf oder Bau selbstgenutzten Wohneigentums.",
    maxFundingLabel: "bis 100.000 € Kredit",
    url: "https://www.kfw.de/inlandsfoerderung/Privatpersonen/Bestandsimmobilien/Finanzierungsangebote/Wohneigentumsprogramm-(124)/",
    applicabilityNotes: "Für Privatpersonen mit Selbstnutzung; gut kombinierbar mit anderen KfW-Produkten.",
    requires: ["Selbstnutzung", "Antrag über Finanzierungspartner"],
  },
  "kfw-300": {
    id: "kfw-300",
    name: "KfW 300 – Wohneigentum für Familien (Neubau)",
    kind: "credit",
    provider: "KfW",
    summary: "Zinsgünstiger Kredit für klimafreundlichen Neubau oder Ersterwerb für Familien mit Kindern.",
    maxFundingLabel: "170.000–270.000 € Kredit",
    url: "https://www.kfw.de/inlandsfoerderung/Privatpersonen/Neubau/F%C3%B6rderprodukte/Wohneigentum-f%C3%BCr-Familien-(300)/",
    applicabilityNotes: "Haushaltseinkommen-Grenze; mindestens ein Kind unter 18; klimafreundlicher Gebäudestandard.",
    requires: ["Kinder im Haushalt", "Einkommensgrenze", "Energieeffizienz-Experte"],
  },
  "kfw-297": {
    id: "kfw-297",
    name: "KfW 297 – Klimafreundlicher Neubau (Eigennutzung)",
    kind: "credit",
    provider: "KfW",
    summary: "Förderkredit für Neubau oder Ersterwerb klimafreundlicher Wohngebäude zur Eigennutzung.",
    maxFundingLabel: "bis 150.000 € je Wohneinheit",
    url: "https://www.kfw.de/inlandsfoerderung/Privatpersonen/Neubau/F%C3%B6rderprodukte/Klimafreundlicher-Neubau-Wohngeb%C3%A4ude-(297-298)/",
    applicabilityNotes: "Effizienzhaus-Stufe oder QNG-Nachweis erforderlich; Antrag vor Baubeginn/Kaufvertrag.",
    requires: ["Neubau oder Ersterwerb", "EH/QNG-Nachweis", "Antrag über Finanzierungspartner"],
  },
  "kfw-298": {
    id: "kfw-298",
    name: "KfW 298 – Klimafreundlicher Neubau (Vermietung/Investoren)",
    kind: "credit",
    provider: "KfW",
    summary: "Förderkredit für Neubau oder Ersterwerb klimafreundlicher Wohngebäude zur Vermietung.",
    maxFundingLabel: "bis 150.000 € je Wohneinheit",
    url: "https://www.kfw.de/inlandsfoerderung/Privatpersonen/Neubau/F%C3%B6rderprodukte/Klimafreundlicher-Neubau-Wohngeb%C3%A4ude-(297-298)/",
    applicabilityNotes: "Für Vermieter und Investoren; QNG-Stufe ermöglicht höheren Kreditrahmen.",
    requires: ["Neubau oder Ersterwerb", "EH/QNG-Nachweis", "Antrag über Finanzierungspartner"],
  },
  "kfw-261": {
    id: "kfw-261",
    name: "KfW 261 – BEG Wohngebäude (Sanierung)",
    kind: "credit",
    provider: "KfW",
    summary: "Zinsgünstiger Kredit für energetische Sanierung oder Kauf eines sanierten Bestandsgebäudes.",
    maxFundingLabel: "bis 150.000 € je Wohneinheit + Tilgungszuschuss",
    url: "https://www.kfw.de/inlandsfoerderung/Privatpersonen/Bestehende-Immobilie/F%C3%B6rderprodukte/Bundesf%C3%B6rderung-f%C3%BCr-effiziente-Geb%C3%A4ude-Wohngeb%C3%A4ude-Kredit-(261-262)/",
    applicabilityNotes: "Tilgungszuschuss je Effizienzhaus-Stufe (5–45 %); Energieeffizienz-Experte erforderlich.",
    requires: ["Bestandsgebäude", "Sanierungskonzept", "Energieeffizienz-Experte"],
  },
  "kfw-458": {
    id: "kfw-458",
    name: "KfW 458 – Heizungsförderung",
    kind: "grant",
    provider: "KfW",
    summary: "Zuschuss für Kauf und Einbau einer neuen, klimafreundlichen Heizung in Bestandsgebäuden.",
    maxFundingLabel: "bis 70 % der förderfähigen Kosten",
    url: "https://www.kfw.de/inlandsfoerderung/Privatpersonen/Bestehende-Immobilie/F%C3%B6rderprodukte/Heizungsf%C3%B6rderung-f%C3%BCr-Privatpersonen-Wohngeb%C3%A4ude-(458)/",
    applicabilityNotes: "Antrag vor Vertragsabschluss; Einkommensbonus und Klimabonus möglich.",
    requires: ["Bestandsgebäude", "Heizungstausch geplant", "Antrag über Meine KfW"],
  },
  "bafa-beg-em": {
    id: "bafa-beg-em",
    name: "BAFA – BEG Einzelmaßnahmen",
    kind: "grant",
    provider: "BAFA",
    summary: "Zuschuss für Einzelmaßnahmen an der Gebäudehülle, Anlagentechnik und Heizungsoptimierung.",
    maxFundingLabel: "15–20 % Zuschuss (+ 50 % Fachplanung)",
    url: "https://www.bafa.de/DE/Energie/Effiziente_Gebaeude/Foerderprogramm_im_Ueberblick/foerderprogramm_im_ueberblick.html",
    applicabilityNotes: "Für Bestandsgebäude; iSFP erhöht Fördersatz; Antrag vor Maßnahmenbeginn.",
    requires: ["Bestandsgebäude", "Technische Projektbeschreibung (TPB)", "Antrag über BAFA-Portal"],
  },
  "regional-fdb": {
    id: "regional-fdb",
    name: "Regionale Förderungen – Förderdatenbank",
    kind: "research",
    provider: "Bund/Länder",
    summary: "Bundes- und Landesprogramme für Wohnungsbau, Modernisierung und Energieeffizienz.",
    maxFundingLabel: "je nach Programm",
    url: "https://www.foerderdatenbank.de/SiteGlobals/FDB/Forms/Suche/Startseitensuche_Formular.html?filterCategories=FundingProgram&templateQueryString=wohnungsbau+energieeffizienz",
    applicabilityNotes: "PLZ und Bundesland prüfen; Programme ändern sich häufig.",
    requires: ["PLZ/Bundesland", "Eigenes Vorhaben"],
  },
};

export const SUBSIDY_PROGRAM_LIST = Object.values(SUBSIDY_PROGRAMS);
