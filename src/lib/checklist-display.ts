export type ChecklistStatus = "unset" | "ok" | "open" | "na";

export const CHECKLIST_STATUS_LEGEND: {
  key: ChecklistStatus;
  label: string;
  hint: string;
}[] = [
  { key: "unset", label: "—", hint: "Noch ohne Bewertung" },
  { key: "ok", label: "OK", hint: "Passt / in Ordnung" },
  { key: "open", label: "?", hint: "Offen, noch klären" },
  { key: "na", label: "n. a.", hint: "Nicht anwendbar" },
];

const VALID_STATUSES = new Set<string>(["unset", "ok", "open", "na"]);

export function parseChecklistStatus(value: string): ChecklistStatus {
  return VALID_STATUSES.has(value) ? (value as ChecklistStatus) : "unset";
}

export function hasChecklistInfo(entry: {
  status: string;
  note: string | null;
} | null | undefined): boolean {
  if (!entry) return false;
  if (entry.note?.trim()) return true;
  return entry.status !== "unset";
}

export function checklistStatusLabel(status: string): string {
  switch (status) {
    case "ok":
      return "OK";
    case "open":
      return "Offen";
    case "na":
      return "n. a.";
    default:
      return "";
  }
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
): { groups: ApartmentChecklistGroupBlock[]; brokerDigest: string } {
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

  const brokerParts: string[] = [];
  for (const g of groups) {
    if (g.brokerQuestions?.trim()) {
      brokerParts.push(`${g.name}:\n${g.brokerQuestions.trim()}`);
    }
  }

  return { groups, brokerDigest: brokerParts.join("\n\n") };
}
