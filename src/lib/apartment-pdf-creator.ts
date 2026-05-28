import type { ReactElement, ReactNode } from "react";
import type { ApartmentPdfData, ApartmentPdfVariant } from "@/lib/apartment-pdf-data";
import { formatDateDe, formatDateTimeDe } from "@/lib/dates";
import { computeBorisLandValueEur } from "@/lib/boris";
import {
  estimateFinancing,
  formatBurdenShare,
  formatPercent,
  purchaseCostLinesWithRenovation,
} from "@/lib/purchase-costs";

export type { ApartmentPdfVariant };
import { formatPrice, formatPricePerPlotSqm, formatPricePerSqm } from "@/lib/scoring";
import { travelModeLabel } from "@/lib/travel-mode";
import type { TravelMode } from "@/lib/travel-mode";

type ReactModule = typeof import("react");
type PdfModule = typeof import("@react-pdf/renderer");

const SCORE_COLORS = {
  high: "#16a34a",
  mid: "#ca8a04",
  low: "#dc2626",
} as const;

/** Reserved bottom area on every page so flowing content does not overlap the fixed footer. */
const PDF_FOOTER_RESERVED_PT = 56;

function scoreBandColor(displayScore: number, dealbreaker: boolean): string {
  if (dealbreaker || displayScore <= 40) return SCORE_COLORS.low;
  if (displayScore >= 71) return SCORE_COLORS.high;
  return SCORE_COLORS.mid;
}

function formatScoreValue(score: number | null): string {
  if (score == null) return "—";
  return String(score);
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

function createStyles(StyleSheet: PdfModule["StyleSheet"]) {
  return StyleSheet.create({
    page: {
      paddingTop: 40,
      paddingBottom: PDF_FOOTER_RESERVED_PT,
      paddingHorizontal: 40,
      fontSize: 10,
      fontFamily: "Helvetica",
      color: "#1e293b",
      lineHeight: 1.45,
    },
    footer: {
      position: "absolute",
      bottom: 20,
      left: 40,
      right: 40,
      marginBottom: -PDF_FOOTER_RESERVED_PT,
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
      minPresenceAhead: 20,
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
}

type PdfStyles = ReturnType<typeof createStyles>;

function keyValueRow(
  React: ReactModule,
  Text: PdfModule["Text"],
  View: PdfModule["View"],
  styles: PdfStyles,
  label: string,
  value: string
): ReactElement | null {
  if (!value || value === "—") return null;
  return React.createElement(
    View,
    { style: styles.row },
    React.createElement(Text, { style: styles.rowLabel }, label),
    React.createElement(Text, { style: styles.rowValue }, value)
  );
}

function section(
  React: ReactModule,
  Text: PdfModule["Text"],
  View: PdfModule["View"],
  styles: PdfStyles,
  title: string,
  children: ReactNode
): ReactElement {
  return React.createElement(
    View,
    { style: styles.section },
    React.createElement(Text, { style: styles.sectionTitle }, title),
    children
  );
}

function optionalSection(
  React: ReactModule,
  Text: PdfModule["Text"],
  View: PdfModule["View"],
  styles: PdfStyles,
  title: string,
  rows: Array<ReactElement | null>
): ReactElement | null {
  const content = rows.filter(Boolean);
  if (content.length === 0) return null;
  return section(React, Text, View, styles, title, content);
}

function hasFilledText(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

function formatStichtag(value: string | null): string | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;
  return `${match[3]}.${match[2]}.${match[1]}`;
}

function locationInsightPdfRows(
  React: ReactModule,
  Text: PdfModule["Text"],
  View: PdfModule["View"],
  styles: PdfStyles,
  rows: { label: string; value: string }[],
  keyPrefix: string
): ReactElement[] {
  return rows.map((row, index) =>
    React.createElement(
      View,
      { key: `${keyPrefix}-${index}`, style: styles.row },
      React.createElement(Text, { style: styles.rowLabel }, row.label),
      React.createElement(Text, { style: styles.rowValue }, row.value)
    )
  );
}

function renderBankFinancingSection(
  React: ReactModule,
  Text: PdfModule["Text"],
  View: PdfModule["View"],
  styles: PdfStyles,
  finance: ApartmentPdfData["finance"],
  price: number | null,
  acquisitionTotal: number | null,
  coldRentMonthly: number | null
): ReactElement | null {
  if (finance.equityAmount == null && finance.loanTermYears == null) return null;

  const totalCost = acquisitionTotal ?? price ?? null;
  const equity = finance.equityAmount ?? 0;
  const term = finance.loanTermYears ?? 0;

  const fin =
    totalCost != null && term > 0
      ? estimateFinancing({
          totalCost,
          equityAmount: equity,
          loanTermYears: term,
          interestRate: finance.interestRate,
        })
      : null;

  const equityShare =
    totalCost && totalCost > 0 && finance.equityAmount != null
      ? finance.equityAmount / totalCost
      : null;
  const ltv = fin && price && price > 0 ? fin.loanAmount / price : null;
  const rateShare =
    fin && finance.netHouseholdIncome && finance.netHouseholdIncome > 0
      ? fin.monthlyPayment / finance.netHouseholdIncome
      : null;

  const rows = [
    keyValueRow(React, Text, View, styles, "Eigenkapital", formatOptionalPrice(finance.equityAmount)),
    keyValueRow(
      React,
      Text,
      View,
      styles,
      "Geschätzter Darlehensbedarf",
      fin ? formatPrice(fin.loanAmount) : "—"
    ),
    keyValueRow(
      React,
      Text,
      View,
      styles,
      "Eigenkapitalquote",
      equityShare != null ? formatPercent(equityShare) : "—"
    ),
    keyValueRow(
      React,
      Text,
      View,
      styles,
      "Beleihungsauslauf (vom Kaufpreis)",
      ltv != null ? formatPercent(ltv) : "—"
    ),
    keyValueRow(
      React,
      Text,
      View,
      styles,
      "Gewünschte Laufzeit",
      term > 0 ? `${term} Jahre` : "—"
    ),
    keyValueRow(
      React,
      Text,
      View,
      styles,
      "Sollzins (Annahme)",
      fin
        ? `${formatPercent(fin.interestRate)}${fin.interestRateIsDefault ? " (PickHome-Standard)" : ""}`
        : "—"
    ),
    keyValueRow(
      React,
      Text,
      View,
      styles,
      "Indikative Monatsrate (Annuität)",
      fin ? `${formatPrice(fin.monthlyPayment)}/Monat` : "—"
    ),
    coldRentMonthly != null && coldRentMonthly > 0
      ? keyValueRow(
          React,
          Text,
          View,
          styles,
          "Kaltmiete / Monat",
          `${formatPrice(coldRentMonthly)}/Monat`
        )
      : null,
    fin && coldRentMonthly != null && coldRentMonthly > 0
      ? keyValueRow(
          React,
          Text,
          View,
          styles,
          "Mietdeckung der Rate",
          formatBurdenShare(coldRentMonthly / fin.monthlyPayment)
        )
      : null,
    keyValueRow(
      React,
      Text,
      View,
      styles,
      "Haushaltsnetto",
      formatOptionalMonthly(finance.netHouseholdIncome)
    ),
    keyValueRow(
      React,
      Text,
      View,
      styles,
      "Belastungsquote (Rate / Netto)",
      rateShare != null ? formatPercent(rateShare) : "—"
    ),
  ];

  return section(React, Text, View, styles, "Finanzierungs-Eckdaten (grobe Schätzung)", rows);
}

function createApartmentPdfBody(
  React: ReactModule,
  pdf: Pick<PdfModule, "Text" | "View">,
  styles: PdfStyles,
  data: ApartmentPdfData,
  variant: ApartmentPdfVariant
): ReactElement {
  const { Text, View } = pdf;
  const { apartment, score, purchaseCosts, acquisitionTotal } = data;
  const isBank = variant === "bank";
  const scoreColor = scoreBandColor(score.displayScore, score.dealbreaker);
  const scoreLabel = score.dealbreaker
    ? `${score.displayScore}/100 · Dealbreaker`
    : `${score.displayScore}/100`;
  const purchaseLines =
    purchaseCosts && apartment.price != null
      ? purchaseCostLinesWithRenovation(purchaseCosts, apartment.renovationCost)
      : [];

  const children: Array<ReactElement | null> = [
    React.createElement(Text, { style: styles.headerTitle, key: "title" }, apartment.title),
    apartment.address
      ? React.createElement(Text, { style: styles.headerSub, key: "address" }, apartment.address)
      : null,
    apartment.listingUrl
      ? React.createElement(
          Text,
          { style: styles.headerSub, key: "listing" },
          `Inserat: ${apartment.listingUrl}`
        )
      : null,
    React.createElement(
      Text,
      { style: styles.headerSub, key: "project" },
      `Projekt: ${data.projectName}`
    ),
    apartment.archivedAt
      ? React.createElement(
          Text,
          { style: [styles.headerSub, { color: SCORE_COLORS.low }], key: "archived" },
          "Archiviert"
        )
      : null,
  ];

  if (!isBank) {
    children.push(
      React.createElement(
        Text,
        { style: [styles.scoreBadge, { backgroundColor: scoreColor }], key: "score" },
        scoreLabel
      ),
      React.createElement(
        Text,
        { style: styles.metaRow, key: "meta" },
        [
          score.rated > 0 ? `${score.rated}/${score.total} Kriterien bewertet` : null,
          data.userName,
          apartment.viewedAt ? `besichtigt ${formatDateDe(apartment.viewedAt, data.timeZone)}` : null,
        ]
          .filter(Boolean)
          .join(" · ")
      )
    );
  }

  children.push(
    optionalSection(React, Text, View, styles, "Eckdaten", [
      keyValueRow(React, Text, View, styles, "Kaufpreis", formatOptionalPrice(apartment.price)),
      apartment.sizeSqm != null
        ? keyValueRow(React, Text, View, styles, "Wohnfläche", `${apartment.sizeSqm} m²`)
        : null,
      apartment.plotSizeSqm != null
        ? keyValueRow(React, Text, View, styles, "Grundstück", `${apartment.plotSizeSqm} m²`)
        : null,
      keyValueRow(
        React,
        Text,
        View,
        styles,
        "Preis/m²",
        formatPricePerSqm(apartment.price, apartment.sizeSqm)
      ),
      keyValueRow(
        React,
        Text,
        View,
        styles,
        "Preis/Grundstück-m²",
        formatPricePerPlotSqm(apartment.price, apartment.plotSizeSqm)
      ),
      apartment.floor != null
        ? keyValueRow(React, Text, View, styles, "Etage", String(apartment.floor))
        : null,
      apartment.yearBuilt != null
        ? keyValueRow(React, Text, View, styles, "Baujahr", String(apartment.yearBuilt))
        : null,
      hasFilledText(apartment.energyClass)
        ? keyValueRow(React, Text, View, styles, "Energieklasse", apartment.energyClass!.trim())
        : null,
      apartment.brokerInvolved
        ? keyValueRow(React, Text, View, styles, "Makler", "Ja")
        : null,
    ]),
    optionalSection(React, Text, View, styles, "Laufende Kosten (monatlich, grob)", [
      keyValueRow(React, Text, View, styles, "Hausgeld", formatOptionalMonthly(apartment.hoaFeeMonthly)),
      keyValueRow(
        React,
        Text,
        View,
        styles,
        "Heizkosten",
        formatOptionalMonthly(apartment.heatingCostMonthly)
      ),
      keyValueRow(
        React,
        Text,
        View,
        styles,
        "Grundsteuer (Jahr)",
        formatOptionalPrice(apartment.propertyTaxAnnual)
      ),
      keyValueRow(
        React,
        Text,
        View,
        styles,
        "Sanierung (einmalig, grob)",
        formatOptionalPrice(apartment.renovationCost)
      ),
      apartment.coldRentMonthly != null && apartment.coldRentMonthly > 0
        ? keyValueRow(
            React,
            Text,
            View,
            styles,
            "Kaltmiete (Einnahme)",
            formatOptionalMonthly(apartment.coldRentMonthly)
          )
        : null,
    ])
  );

  if (purchaseCosts && apartment.price != null) {
    children.push(
      section(React, Text, View, styles, "Kaufnebenkosten (grobe Schätzung)", [
        keyValueRow(React, Text, View, styles, "Kaufpreis", formatPrice(apartment.price)),
        ...purchaseLines.map((line) =>
          keyValueRow(
            React,
            Text,
            View,
            styles,
            line.rate > 0 ? `${line.label} · ${formatPercent(line.rate)}` : line.label,
            formatPrice(line.amount)
          )
        ),
        keyValueRow(
          React,
          Text,
          View,
          styles,
          "Kaufnebenkosten (grob)",
          formatPrice(purchaseCosts.ancillaryTotal)
        ),
        acquisitionTotal != null
          ? keyValueRow(
              React,
              Text,
              View,
              styles,
              "Geschätzte Gesamtkosten",
              formatPrice(acquisitionTotal)
            )
          : null,
      ])
    );
  }

  if (isBank) {
    const bankFinancing = renderBankFinancingSection(
      React,
      Text,
      View,
      styles,
      data.finance,
      apartment.price,
      acquisitionTotal,
      apartment.coldRentMonthly
    );
    if (bankFinancing) children.push(bankFinancing);

    if (apartment.description?.trim()) {
      children.push(
        section(
          React,
          Text,
          View,
          styles,
          "Beschreibung",
          React.createElement(Text, { style: styles.bodyText }, apartment.description.trim())
        )
      );
    }

    if (data.priceHistory.length > 0) {
      children.push(
        section(
          React,
          Text,
          View,
          styles,
          "Preis-Historie",
          data.priceHistory.map((entry, index) =>
            React.createElement(
              View,
              { key: `${entry.recordedAt.toISOString()}-${index}`, style: styles.row },
              React.createElement(
                Text,
                { style: styles.rowLabel },
                `${formatDateDe(entry.recordedAt, data.timeZone)} · ${entry.sourceLabel}`
              ),
              React.createElement(
                Text,
                { style: styles.rowValue },
                `${formatPrice(entry.price)}${
                  entry.previousPrice != null ? ` (vorher ${formatPrice(entry.previousPrice)})` : ""
                }`
              )
            )
          )
        )
      );
    }

    if (data.boris.status === "ok" && data.boris.results.length > 0) {
      children.push(
        section(
          React,
          Text,
          View,
          styles,
          "Bodenrichtwert (BORIS-D, Orientierung)",
          data.boris.results.map((result, index) => {
            const details = [
              result.nutzungsartLabel,
              formatStichtag(result.stichtag) ? `Stichtag ${formatStichtag(result.stichtag)}` : null,
            ]
              .filter(Boolean)
              .join(" · ");
            const landValue =
              apartment.plotSizeSqm != null
                ? computeBorisLandValueEur(result.brwEurPerSqm, apartment.plotSizeSqm)
                : null;
            return React.createElement(
              View,
              { key: `boris-bank-${index}`, style: styles.row },
              React.createElement(
                Text,
                { style: styles.rowLabel },
                `${result.kategorieLabel}${details ? ` · ${details}` : ""}`
              ),
              React.createElement(
                Text,
                { style: styles.rowValue },
                `${result.brwEurPerSqm.toLocaleString("de-DE")} €/m²${
                  landValue != null ? ` · grob ${formatPrice(landValue)}` : ""
                }`
              )
            );
          })
        )
      );
    }

    const floodRows = data.locationInsights?.flood ?? [];
    if (floodRows.length > 0) {
      children.push(
        section(
          React,
          Text,
          View,
          styles,
          "Hochwasser (BfG, Orientierung)",
          locationInsightPdfRows(React, Text, View, styles, floodRows, "flood-bank")
        )
      );
    }
  } else {
    if (apartment.description?.trim()) {
      children.push(
        section(
          React,
          Text,
          View,
          styles,
          "Beschreibung",
          React.createElement(Text, { style: styles.bodyText }, apartment.description.trim())
        )
      );
    }

    if (apartment.notes?.trim()) {
      children.push(
        section(
          React,
          Text,
          View,
          styles,
          "Notizen",
          React.createElement(Text, { style: styles.bodyText }, apartment.notes.trim())
        )
      );
    }

    children.push(
      ...(() => {
        const ratingGroups = data.ratingGroups
          .map((group) => {
            const criteria = group.criteria.filter(
              (criterion) => criterion.score != null || hasFilledText(criterion.note)
            );
            if (criteria.length === 0) return null;
            return React.createElement(
              View,
              { key: group.groupName },
              React.createElement(Text, { style: styles.groupTitle }, group.groupName),
              criteria.map((criterion) =>
                React.createElement(
                  View,
                  { key: criterion.criterionId, style: styles.ratingRow },
                  React.createElement(
                    Text,
                    { style: styles.ratingName },
                    `${criterion.name}${criterion.isDealbreaker ? " (DB)" : ""}`
                  ),
                  React.createElement(
                    Text,
                    { style: styles.ratingScore },
                    criterion.score != null ? formatScoreValue(criterion.score) : ""
                  ),
                  React.createElement(
                    Text,
                    { style: styles.ratingNote },
                    criterion.note?.trim() ?? ""
                  )
                )
              )
            );
          })
          .filter(Boolean);
        if (ratingGroups.length === 0) return [];
        return [
          section(React, Text, View, styles, "Kriterien-Bewertungen", ratingGroups),
        ];
      })()
    );

    const commuteContent = data.commutePeople
      .map((person) => {
        const legs = person.legs
          .map((leg) => {
            if (leg.durationText) {
              const distance = leg.distanceText ? ` · ${leg.distanceText}` : "";
              const connection = leg.connectionSummary ? ` · ${leg.connectionSummary}` : "";
              const mode = leg.effectiveMode ? ` (${commuteModeLabel(leg.effectiveMode)})` : "";
              return React.createElement(
                Text,
                { key: leg.addressId, style: styles.commuteLeg },
                `${leg.label}: ${leg.durationText}${distance}${connection}${mode}`
              );
            }
            return null;
          })
          .filter(Boolean);
        if (legs.length === 0) return null;
        return React.createElement(
          View,
          { key: person.userId, style: styles.commuteMember },
          React.createElement(
            Text,
            { style: { fontFamily: "Helvetica-Bold", marginBottom: 2 } },
            `${person.name} · ${travelModeLabel(person.travelMode)}`
          ),
          ...legs
        );
      })
      .filter(Boolean);

    if (commuteContent.length > 0) {
      children.push(section(React, Text, View, styles, "Fahrtwege", commuteContent));
    }

    if (data.viewings.length > 0) {
      children.push(
        section(
          React,
          Text,
          View,
          styles,
          "Besichtigungen",
          data.viewings.map((viewing, index) => {
            const note = viewing.note?.trim();
            return React.createElement(
              View,
              { key: `${viewing.scheduledAt.toISOString()}-${index}`, style: styles.row },
              React.createElement(
                Text,
                { style: note ? styles.rowLabel : styles.rowValue },
                formatDateTimeDe(viewing.scheduledAt, data.timeZone)
              ),
              note
                ? React.createElement(Text, { style: styles.rowValue }, note)
                : null
            );
          })
        )
      );
    }

    if (data.priceHistory.length > 0) {
      children.push(
        section(
          React,
          Text,
          View,
          styles,
          "Preis-Historie",
          data.priceHistory.map((entry, index) =>
            React.createElement(
              View,
              { key: `${entry.recordedAt.toISOString()}-${index}`, style: styles.row },
              React.createElement(
                Text,
                { style: styles.rowLabel },
                `${formatDateDe(entry.recordedAt, data.timeZone)} · ${entry.sourceLabel}`
              ),
              React.createElement(
                Text,
                { style: styles.rowValue },
                `${formatPrice(entry.price)}${
                  entry.previousPrice != null ? ` (vorher ${formatPrice(entry.previousPrice)})` : ""
                }`
              )
            )
          )
        )
      );
    }

    if (data.boris.status === "ok" && data.boris.results.length > 0) {
      children.push(
        section(
          React,
          Text,
          View,
          styles,
          "Bodenrichtwert (BORIS-D, Orientierung)",
          data.boris.results.map((result, index) => {
            const details = [
              result.nutzungsartLabel,
              formatStichtag(result.stichtag) ? `Stichtag ${formatStichtag(result.stichtag)}` : null,
            ]
              .filter(Boolean)
              .join(" · ");
            const landValue =
              apartment.plotSizeSqm != null
                ? computeBorisLandValueEur(result.brwEurPerSqm, apartment.plotSizeSqm)
                : null;
            return React.createElement(
              View,
              { key: `boris-full-${index}`, style: styles.row },
              React.createElement(
                Text,
                { style: styles.rowLabel },
                `${result.kategorieLabel}${details ? ` · ${details}` : ""}`
              ),
              React.createElement(
                Text,
                { style: styles.rowValue },
                `${result.brwEurPerSqm.toLocaleString("de-DE")} €/m²${
                  landValue != null ? ` · grob ${formatPrice(landValue)}` : ""
                }`
              )
            );
          })
        )
      );
    }

    const environment = data.locationInsights?.environment ?? [];
    const noise = data.locationInsights?.noise ?? [];
    const air = data.locationInsights?.air ?? [];
    const flood = data.locationInsights?.flood ?? [];
    if (environment.length > 0) {
      children.push(
        section(
          React,
          Text,
          View,
          styles,
          "Standort & Umfeld · OSM",
          locationInsightPdfRows(React, Text, View, styles, environment, "loc-env")
        )
      );
    }
    if (noise.length > 0) {
      children.push(
        section(
          React,
          Text,
          View,
          styles,
          "Standort & Umfeld · Lärm (UBA)",
          locationInsightPdfRows(React, Text, View, styles, noise, "loc-noise")
        )
      );
    }
    if (air.length > 0) {
      children.push(
        section(
          React,
          Text,
          View,
          styles,
          "Standort & Umfeld · Luftqualität (UBA)",
          locationInsightPdfRows(React, Text, View, styles, air, "loc-air")
        )
      );
    }
    if (flood.length > 0) {
      children.push(
        section(
          React,
          Text,
          View,
          styles,
          "Standort & Umfeld · Hochwasser (BfG)",
          locationInsightPdfRows(React, Text, View, styles, flood, "loc-flood")
        )
      );
    }
  }

  return React.createElement(View, null, ...children.filter(Boolean));
}

function createApartmentPdfFooter(
  React: ReactModule,
  Text: PdfModule["Text"],
  styles: PdfStyles,
  data: ApartmentPdfData,
  variant: ApartmentPdfVariant
): ReactElement {
  const label = variant === "bank" ? "Datenauszug" : "Datenauszug Full";
  return React.createElement(
    Text,
    { style: styles.footer, fixed: true, wrap: false },
    `PickHome · ${label} · ${formatDateTimeDe(data.exportedAt, data.timeZone)}`
  );
}

export function createApartmentPdfDocument(
  React: ReactModule,
  pdf: PdfModule,
  data: ApartmentPdfData,
  options: { variant?: ApartmentPdfVariant } = {}
): ReactElement {
  const { Document, Page, StyleSheet } = pdf;
  const styles = createStyles(StyleSheet);
  const { apartment } = data;
  const variant = options.variant ?? "full";

  return React.createElement(
    Document,
    {
      title: apartment.title,
      author: "PickHome",
      subject: variant === "bank" ? "Finanzierungsdaten" : "Immobilien-Zusammenfassung",
    },
    React.createElement(
      Page,
      { size: "A4", style: styles.page, wrap: true },
      createApartmentPdfBody(React, pdf, styles, data, variant),
      createApartmentPdfFooter(React, pdf.Text, styles, data, variant)
    )
  );
}
