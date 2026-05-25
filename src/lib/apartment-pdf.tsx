import type { ReactNode } from "react";
import {
  Document,
  Page,
  renderToBuffer,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import type { ApartmentPdfData } from "@/lib/apartment-pdf-data";
import { commuteUnavailableMessage } from "@/lib/commute";
import { formatDateDe, formatDateTimeDe } from "@/lib/dates";
import {
  formatPercent,
  purchaseCostLinesWithRenovation,
} from "@/lib/purchase-costs";
import { formatPrice, formatPricePerPlotSqm, formatPricePerSqm } from "@/lib/scoring";
import { travelModeLabel } from "@/lib/travel-mode";
import type { TravelMode } from "@/lib/travel-mode";

const SCORE_COLORS = {
  high: "#16a34a",
  mid: "#ca8a04",
  low: "#dc2626",
} as const;

function scoreBandColor(displayScore: number, dealbreaker: boolean): string {
  if (dealbreaker || displayScore <= 40) return SCORE_COLORS.low;
  if (displayScore >= 71) return SCORE_COLORS.high;
  return SCORE_COLORS.mid;
}

function formatScoreValue(score: number | null): string {
  if (score == null) return "—";
  return String(score);
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 48,
    paddingHorizontal: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#1e293b",
    lineHeight: 1.45,
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    fontSize: 8,
    color: "#64748b",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 6,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  headerSub: {
    fontSize: 10,
    color: "#475569",
    marginBottom: 2,
  },
  scoreBadge: {
    alignSelf: "flex-start",
    marginTop: 8,
    marginBottom: 4,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 4,
    color: "#ffffff",
    fontFamily: "Helvetica-Bold",
    fontSize: 12,
  },
  metaRow: {
    fontSize: 9,
    color: "#64748b",
    marginBottom: 12,
  },
  section: {
    marginTop: 14,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: "#cbd5e1",
    color: "#0f172a",
  },
  row: {
    flexDirection: "row",
    marginBottom: 3,
  },
  rowLabel: {
    width: "42%",
    color: "#475569",
  },
  rowValue: {
    width: "58%",
    color: "#0f172a",
  },
  groupTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    marginTop: 6,
    marginBottom: 4,
    color: "#334155",
  },
  ratingRow: {
    flexDirection: "row",
    marginBottom: 2,
    paddingLeft: 4,
  },
  ratingName: {
    width: "55%",
    color: "#334155",
  },
  ratingScore: {
    width: "12%",
    fontFamily: "Helvetica-Bold",
  },
  ratingNote: {
    width: "33%",
    color: "#64748b",
    fontSize: 9,
  },
  bodyText: {
    fontSize: 10,
    color: "#334155",
    marginBottom: 4,
  },
  muted: {
    color: "#64748b",
    fontSize: 9,
  },
  commuteMember: {
    marginBottom: 8,
  },
  commuteLeg: {
    marginLeft: 8,
    marginBottom: 2,
  },
});

function KeyValueRow({ label, value }: { label: string; value: string }) {
  if (!value || value === "—") return null;
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function formatOptionalPrice(value: number | null | undefined): string {
  if (value == null) return "—";
  return formatPrice(value);
}

function formatOptionalMonthly(value: number | null | undefined): string {
  if (value == null) return "—";
  return `${formatPrice(value)}/Monat`;
}

function commuteModeLabel(mode: string | null): string {
  if (!mode) return "";
  if (mode === "foot" || mode === "bike" || mode === "driving" || mode === "transit") {
    return travelModeLabel(mode as TravelMode);
  }
  return mode;
}

export function ApartmentPdfDocument({ data }: { data: ApartmentPdfData }) {
  const { apartment, score, purchaseCosts, acquisitionTotal } = data;
  const scoreColor = scoreBandColor(score.displayScore, score.dealbreaker);
  const scoreLabel = score.dealbreaker
    ? `${score.displayScore}/100 · Dealbreaker`
    : `${score.displayScore}/100`;

  const purchaseLines =
    purchaseCosts && apartment.price != null
      ? purchaseCostLinesWithRenovation(purchaseCosts, apartment.renovationCost)
      : [];

  return (
    <Document
      title={apartment.title}
      author="PickHome"
      subject="Immobilien-Zusammenfassung"
    >
      <Page size="A4" style={styles.page}>
        <Text style={styles.headerTitle}>{apartment.title}</Text>
        {apartment.address ? <Text style={styles.headerSub}>{apartment.address}</Text> : null}
        {apartment.listingUrl ? (
          <Text style={styles.headerSub}>Inserat: {apartment.listingUrl}</Text>
        ) : null}
        <Text style={styles.headerSub}>Projekt: {data.projectName}</Text>
        {apartment.archivedAt ? (
          <Text style={[styles.headerSub, { color: SCORE_COLORS.low }]}>Archiviert</Text>
        ) : null}

        <Text style={[styles.scoreBadge, { backgroundColor: scoreColor }]}>{scoreLabel}</Text>
        <Text style={styles.metaRow}>
          {score.rated}/{score.total} Kriterien bewertet · {data.userName}
          {apartment.viewedAt
            ? ` · besichtigt ${formatDateDe(apartment.viewedAt, data.timeZone)}`
            : ""}
        </Text>

        <Section title="Eckdaten">
          <KeyValueRow label="Kaufpreis" value={formatOptionalPrice(apartment.price)} />
          <KeyValueRow
            label="Wohnfläche"
            value={
              apartment.sizeSqm != null ? `${apartment.sizeSqm} m²` : "—"
            }
          />
          <KeyValueRow
            label="Grundstück"
            value={
              apartment.plotSizeSqm != null ? `${apartment.plotSizeSqm} m²` : "—"
            }
          />
          <KeyValueRow
            label="Preis/m²"
            value={formatPricePerSqm(apartment.price, apartment.sizeSqm)}
          />
          <KeyValueRow
            label="Preis/Grundstück-m²"
            value={formatPricePerPlotSqm(apartment.price, apartment.plotSizeSqm)}
          />
          <KeyValueRow
            label="Etage"
            value={apartment.floor != null ? String(apartment.floor) : "—"}
          />
          <KeyValueRow
            label="Baujahr"
            value={apartment.yearBuilt != null ? String(apartment.yearBuilt) : "—"}
          />
          <KeyValueRow label="Energieklasse" value={apartment.energyClass ?? "—"} />
          <KeyValueRow
            label="Makler"
            value={apartment.brokerInvolved ? "Ja" : "Nein"}
          />
        </Section>

        <Section title="Laufende Kosten (monatlich, grob)">
          <KeyValueRow label="Hausgeld" value={formatOptionalMonthly(apartment.hoaFeeMonthly)} />
          <KeyValueRow
            label="Heizkosten"
            value={formatOptionalMonthly(apartment.heatingCostMonthly)}
          />
          <KeyValueRow
            label="Grundsteuer (Jahr)"
            value={formatOptionalPrice(apartment.propertyTaxAnnual)}
          />
          <KeyValueRow
            label="Sanierung (einmalig, grob)"
            value={formatOptionalPrice(apartment.renovationCost)}
          />
        </Section>

        {purchaseCosts && apartment.price != null ? (
          <Section title="Kaufnebenkosten (grobe Schätzung)">
            <KeyValueRow label="Kaufpreis" value={formatPrice(apartment.price)} />
            {purchaseLines.map((line) => (
              <KeyValueRow
                key={line.key}
                label={
                  line.rate > 0 ? `${line.label} · ${formatPercent(line.rate)}` : line.label
                }
                value={formatPrice(line.amount)}
              />
            ))}
            <KeyValueRow
              label="Kaufnebenkosten (grob)"
              value={formatPrice(purchaseCosts.ancillaryTotal)}
            />
            {acquisitionTotal != null ? (
              <KeyValueRow
                label="Geschätzte Gesamtkosten"
                value={formatPrice(acquisitionTotal)}
              />
            ) : null}
          </Section>
        ) : null}

        {apartment.description?.trim() ? (
          <Section title="Beschreibung">
            <Text style={styles.bodyText}>{apartment.description.trim()}</Text>
          </Section>
        ) : null}

        {apartment.notes?.trim() ? (
          <Section title="Notizen">
            <Text style={styles.bodyText}>{apartment.notes.trim()}</Text>
          </Section>
        ) : null}

        <Section title="Kriterien-Bewertungen">
          {data.ratingGroups.map((group) => (
            <View key={group.groupName}>
              <Text style={styles.groupTitle}>{group.groupName}</Text>
              {group.criteria.map((criterion) => (
                <View key={criterion.criterionId} style={styles.ratingRow}>
                  <Text style={styles.ratingName}>
                    {criterion.name}
                    {criterion.isDealbreaker ? " (DB)" : ""}
                  </Text>
                  <Text style={styles.ratingScore}>{formatScoreValue(criterion.score)}</Text>
                  <Text style={styles.ratingNote}>{criterion.note?.trim() ?? ""}</Text>
                </View>
              ))}
            </View>
          ))}
        </Section>

        {data.commutePeople.length > 0 ? (
          <Section title="Fahrtwege">
            {data.commutePeople.map((person) => (
              <View key={person.userId} style={styles.commuteMember}>
                <Text style={{ fontFamily: "Helvetica-Bold", marginBottom: 2 }}>
                  {person.name} · {travelModeLabel(person.travelMode)}
                </Text>
                {person.legs.length === 0 ? (
                  <Text style={styles.muted}>Keine Adressen hinterlegt.</Text>
                ) : (
                  person.legs.map((leg) => {
                    const unavailable = commuteUnavailableMessage(leg.unavailableReason);
                    const duration =
                      leg.durationText ??
                      (unavailable ? unavailable : "—");
                    const distance = leg.distanceText ? ` · ${leg.distanceText}` : "";
                    const connection = leg.connectionSummary
                      ? ` · ${leg.connectionSummary}`
                      : "";
                    const mode = leg.effectiveMode
                      ? ` (${commuteModeLabel(leg.effectiveMode)})`
                      : "";
                    return (
                      <Text key={leg.addressId} style={styles.commuteLeg}>
                        {leg.label}: {duration}
                        {distance}
                        {connection}
                        {mode}
                      </Text>
                    );
                  })
                )}
              </View>
            ))}
          </Section>
        ) : null}

        {data.viewings.length > 0 ? (
          <Section title="Besichtigungen">
            {data.viewings.map((viewing, index) => (
              <View key={`${viewing.scheduledAt.toISOString()}-${index}`} style={styles.row}>
                <Text style={styles.rowLabel}>
                  {formatDateTimeDe(viewing.scheduledAt, data.timeZone)}
                </Text>
                <Text style={styles.rowValue}>{viewing.note?.trim() ?? "—"}</Text>
              </View>
            ))}
          </Section>
        ) : null}

        {data.priceHistory.length > 0 ? (
          <Section title="Preis-Historie">
            {data.priceHistory.map((entry, index) => (
              <View key={`${entry.recordedAt.toISOString()}-${index}`} style={styles.row}>
                <Text style={styles.rowLabel}>
                  {formatDateDe(entry.recordedAt, data.timeZone)} · {entry.sourceLabel}
                </Text>
                <Text style={styles.rowValue}>
                  {formatPrice(entry.price)}
                  {entry.previousPrice != null
                    ? ` (vorher ${formatPrice(entry.previousPrice)})`
                    : ""}
                </Text>
              </View>
            ))}
          </Section>
        ) : null}

        <Text style={styles.footer} fixed>
          PickHome · Export {formatDateTimeDe(data.exportedAt, data.timeZone)} · Grobe Schätzungen,
          keine Rechts- oder Steuerberatung
        </Text>
      </Page>
    </Document>
  );
}

export async function renderApartmentPdfBuffer(data: ApartmentPdfData): Promise<Buffer> {
  return renderToBuffer(<ApartmentPdfDocument data={data} />);
}
