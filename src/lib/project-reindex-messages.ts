import type { ReindexProjectCommuteResult } from "@/lib/commute-reindex";
import type { ReindexProjectDocumentsResult } from "@/lib/pdf-reindex";

export function formatDocumentsReindexMessage(result: ReindexProjectDocumentsResult): string {
  if (result.processed === 0) return "Keine PDFs in diesem Projekt.";
  return `${result.processed} PDF(s) verarbeitet: ${result.withText} mit Text, ${result.withoutText} ohne Textlayer${result.missingFile > 0 ? `, ${result.missingFile} Datei(en) fehlen` : ""}.`;
}

export function formatCommuteReindexMessage(result: ReindexProjectCommuteResult): string {
  if (result.apartmentsTotal === 0) return "Keine aktiven Immobilien in diesem Projekt.";
  return `${result.routesComputed} Route(n) berechnet (${result.apartmentsWithCoords} von ${result.apartmentsTotal} Immobilie(n) mit Koordinaten)${result.routesSkipped > 0 ? `, ${result.routesSkipped} übersprungen` : ""}${result.routesFailed > 0 ? `, ${result.routesFailed} fehlgeschlagen` : ""}.`;
}
