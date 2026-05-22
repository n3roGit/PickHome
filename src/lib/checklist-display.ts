export type ChecklistStatus = "unset" | "not_ok" | "ok";

/** Slider positions: 0 = unset, 1 = not_ok, 2 = ok */
export const CHECKLIST_STATUS_VALUES: ChecklistStatus[] = ["unset", "not_ok", "ok"];

export const CHECKLIST_STATUS_LEGEND: {
  key: ChecklistStatus;
  symbol: string;
  hint: string;
  ariaLabel: string;
}[] = [
  { key: "unset", symbol: "○", hint: "Noch ohne Bewertung", ariaLabel: "Nicht bewertet" },
  { key: "not_ok", symbol: "✕", hint: "Nicht in Ordnung", ariaLabel: "Nicht OK" },
  { key: "ok", symbol: "✓", hint: "Passt / in Ordnung", ariaLabel: "OK" },
];

const VALID_STATUSES = new Set<string>([
  "unset",
  "not_ok",
  "ok",
  "open",
  "na",
]);

const LEGACY_STATUS_MAP: Record<string, ChecklistStatus> = {
  open: "not_ok",
  na: "unset",
};

export function parseChecklistStatus(value: string): ChecklistStatus {
  const raw = String(value ?? "").trim();
  if (!VALID_STATUSES.has(raw)) return "unset";
  if (raw in LEGACY_STATUS_MAP) return LEGACY_STATUS_MAP[raw];
  return raw as ChecklistStatus;
}

export function checklistStatusToIndex(status: ChecklistStatus): number {
  const idx = CHECKLIST_STATUS_VALUES.indexOf(status);
  return idx >= 0 ? idx : 0;
}

export function checklistStatusFromIndex(index: number): ChecklistStatus {
  return CHECKLIST_STATUS_VALUES[index] ?? "unset";
}

export function hasChecklistInfo(entry: {
  status: string;
  note: string | null;
} | null | undefined): boolean {
  if (!entry) return false;
  if (entry.note?.trim()) return true;
  const status = parseChecklistStatus(entry.status);
  return status !== "unset";
}

export function checklistStatusLabel(status: string): string {
  switch (parseChecklistStatus(status)) {
    case "ok":
      return "OK";
    case "not_ok":
      return "Nicht OK";
    default:
      return "";
  }
}

export function checklistStatusSymbol(status: string): string {
  const parsed = parseChecklistStatus(status);
  return CHECKLIST_STATUS_LEGEND.find((s) => s.key === parsed)?.symbol ?? "○";
}

export function checklistItemDisplayName(item: {
  name: string | null;
  criterion: { name: string } | null;
}): string {
  if (item.criterion) return item.criterion.name;
  return item.name?.trim() ?? "";
}

export function filterChecklistItemsForUser<
  T extends { assigneeUserId: string | null },
>(items: T[], userId: string): T[] {
  return items.filter(
    (item) => item.assigneeUserId == null || item.assigneeUserId === userId
  );
}

export function userCanFillChecklistItem(
  assigneeUserId: string | null,
  userId: string
): boolean {
  return assigneeUserId == null || assigneeUserId === userId;
}

export type ApartmentChecklistItemRow = {
  id: string;
  assigneeUserId: string | null;
  isCustom: boolean;
  groupId: string;
  groupName: string;
  groupSortOrder: number;
  displayName: string;
  entry?: { status: string; note: string | null };
};

export type ApartmentChecklistGroupBlock = {
  id: string;
  name: string;
  brokerQuestions: string | null;
  items: ApartmentChecklistItemRow[];
};

/** All criterion groups with Makler-Fragen (independent of enabled checklist points). */
export function buildBrokerQuestionsDigest(
  groups: { name: string; brokerQuestions: string | null; sortOrder: number }[]
): string {
  const brokerParts: string[] = [];
  const sorted = [...groups].sort((a, b) => a.sortOrder - b.sortOrder);
  for (const g of sorted) {
    if (g.brokerQuestions?.trim()) {
      brokerParts.push(`${g.name}:\n${g.brokerQuestions.trim()}`);
    }
  }
  return brokerParts.join("\n\n");
}

export function buildApartmentChecklistGroups(
  items: {
    id: string;
    criterionId: string | null;
    name: string | null;
    assigneeUserId: string | null;
    criterion: { name: string } | null;
    criterionGroup: {
      id: string;
      name: string;
      sortOrder: number;
      brokerQuestions: string | null;
    };
  }[],
  entries: { itemId: string; status: string; note: string | null }[],
  userId: string
): { groups: ApartmentChecklistGroupBlock[] } {
  const entryByItem = new Map(entries.map((e) => [e.itemId, e]));
  const visible = items.filter(
    (i) => i.assigneeUserId == null || i.assigneeUserId === userId
  );

  const groupMap = new Map<string, ApartmentChecklistGroupBlock>();
  for (const item of visible) {
    const g = item.criterionGroup;
    let block = groupMap.get(g.id);
    if (!block) {
      block = {
        id: g.id,
        name: g.name,
        brokerQuestions: g.brokerQuestions,
        items: [],
      };
      groupMap.set(g.id, block);
    }
    block.items.push({
      id: item.id,
      assigneeUserId: item.assigneeUserId,
      isCustom: !item.criterionId,
      groupId: g.id,
      groupName: g.name,
      groupSortOrder: g.sortOrder,
      displayName: checklistItemDisplayName(item),
      entry: entryByItem.get(item.id),
    });
  }

  const groups = [...groupMap.values()].sort(
    (a, b) => (a.items[0]?.groupSortOrder ?? 0) - (b.items[0]?.groupSortOrder ?? 0)
  );

  return { groups };
}
