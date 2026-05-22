/** Shared styles for apartment detail header actions. */
export const APARTMENT_TOOLBAR_BTN =
  "inline-flex items-center justify-center gap-1.5 text-sm font-medium px-2.5 sm:px-3 py-1.5 rounded-lg border min-h-9 shrink-0 whitespace-nowrap transition-colors disabled:opacity-50";

export const APARTMENT_TOOLBAR_BTN_NEUTRAL = `${APARTMENT_TOOLBAR_BTN} border-pn-border bg-pn-bg-surface hover:bg-pn-bg-subtle text-pn-text-primary`;

export const APARTMENT_TOOLBAR_BTN_ACCENT = `${APARTMENT_TOOLBAR_BTN} border-pn-accent/50 text-pn-accent hover:bg-pn-bg-subtle`;

export const APARTMENT_TOOLBAR_BTN_DANGER = `${APARTMENT_TOOLBAR_BTN} border-pn-score-low/35 text-pn-score-low hover:bg-pn-score-low-bg`;
