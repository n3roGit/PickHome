import { describe, expect, it } from "vitest";
import { normalizeApartmentChatMessages } from "@/lib/apartment-llm-chat-request";
import { formatApartmentChatHistoryRecap } from "@/lib/llm-apartment-chat";

describe("formatApartmentChatHistoryRecap", () => {
  it("returns empty string when there is no prior conversation", () => {
    expect(formatApartmentChatHistoryRecap([])).toBe("");
  });

  it("parses full messages array with trailing user turn", () => {
    const messages = normalizeApartmentChatMessages({
      messages: [
        { role: "user", content: "Frage eins" },
        { role: "assistant", content: "Antwort" },
        { role: "user", content: "Frage zwei" },
      ],
    });
    expect(messages).toHaveLength(3);
    expect(messages?.[2]?.content).toBe("Frage zwei");
  });

  it("parses legacy message and history", () => {
    const messages = normalizeApartmentChatMessages({
      message: "Neu",
      history: [{ role: "user", content: "Alt" }],
    });
    expect(messages).toEqual([
      { role: "user", content: "Alt" },
      { role: "user", content: "Neu" },
    ]);
  });

  it("includes user and assistant turns for the system recap", () => {
    const recap = formatApartmentChatHistoryRecap([
      { role: "user", content: "Welche Energieklasse hat das Haus?" },
      { role: "assistant", content: "Energieklasse F." },
    ]);
    expect(recap).toContain("Bisheriger Chatverlauf");
    expect(recap).toContain("Nutzer: Welche Energieklasse hat das Haus?");
    expect(recap).toContain("Assistent: Energieklasse F.");
  });
});
