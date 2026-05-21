export function ApartmentConflictBanner() {
  return (
    <p
      role="alert"
      className="text-sm text-pn-score-low bg-pn-score-low-bg border border-pn-score-low/30 px-4 py-3 rounded-lg mb-6"
    >
      Diese Immobilie wurde inzwischen von jemand anderem geändert. Bitte die Seite aktualisieren
      (z. B. F5), die aktuellen Daten prüfen und dann erneut speichern — sonst würdest du die
      Änderungen überschreiben.
    </p>
  );
}
