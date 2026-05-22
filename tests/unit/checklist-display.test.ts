import { describe, expect, it } from "vitest";
import {
  buildBrokerQuestionsDigest,
  checklistStatusFromIndex,
  checklistStatusToIndex,
  filterChecklistItemsForUser,
  hasChecklistInfo,
  parseChecklistStatus,
  userCanFillChecklistItem,
} from "@/lib/checklist-display";

describe("hasChecklistInfo", () => {
  it("returns false for empty entry", () => {
    expect(hasChecklistInfo({ status: "unset", note: null })).toBe(false);
    expect(hasChecklistInfo(null)).toBe(false);
  });

  it("returns true when note or status set", () => {
    expect(hasChecklistInfo({ status: "unset", note: "  hello " })).toBe(true);
    expect(hasChecklistInfo({ status: "ok", note: null })).toBe(true);
    expect(hasChecklistInfo({ status: "not_ok", note: null })).toBe(true);
  });
});

describe("parseChecklistStatus", () => {
  it("maps legacy values", () => {
    expect(parseChecklistStatus("open")).toBe("not_ok");
    expect(parseChecklistStatus("na")).toBe("unset");
  });

  it("round-trips slider indices", () => {
    expect(checklistStatusFromIndex(checklistStatusToIndex("ok"))).toBe("ok");
    expect(checklistStatusToIndex("not_ok")).toBe(1);
  });
});

describe("filterChecklistItemsForUser", () => {
  const items = [
    { assigneeUserId: null },
    { assigneeUserId: "u1" },
    { assigneeUserId: "u2" },
  ];

  it("includes both and own assignments", () => {
    const filtered = filterChecklistItemsForUser(items, "u1");
    expect(filtered).toHaveLength(2);
  });
});

describe("buildBrokerQuestionsDigest", () => {
  it("includes all groups with text, not only groups with checklist items", () => {
    const digest = buildBrokerQuestionsDigest([
      { name: "Technik", brokerQuestions: "Heizung?", sortOrder: 2 },
      { name: "Lage", brokerQuestions: "Lärm?", sortOrder: 1 },
      { name: "Feeling", brokerQuestions: null, sortOrder: 0 },
    ]);
    expect(digest).toBe("Lage:\nLärm?\n\nTechnik:\nHeizung?");
  });
});

describe("userCanFillChecklistItem", () => {
  it("allows both or assigned user", () => {
    expect(userCanFillChecklistItem(null, "u1")).toBe(true);
    expect(userCanFillChecklistItem("u1", "u1")).toBe(true);
    expect(userCanFillChecklistItem("u2", "u1")).toBe(false);
  });
});
