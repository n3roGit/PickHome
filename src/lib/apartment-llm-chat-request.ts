import type { ApartmentChatTurn } from "@/lib/llm-apartment-chat";

export const MAX_APARTMENT_CHAT_MESSAGE_LENGTH = 4000;
export const MAX_APARTMENT_CHAT_TURNS = 12;

function normalizeTurn(m: {
  role: string;
  content: string;
}): ApartmentChatTurn | null {
  if (m.role !== "user" && m.role !== "assistant") return null;
  const content = String(m.content ?? "").trim();
  if (!content) return null;
  return {
    role: m.role,
    content: content.slice(0, MAX_APARTMENT_CHAT_MESSAGE_LENGTH),
  };
}

/** Parse POST body for apartment LLM chat (full messages or legacy message + history). */
export function normalizeApartmentChatMessages(body: {
  message?: string;
  history?: { role: string; content: string }[];
  messages?: { role: string; content: string }[];
}): ApartmentChatTurn[] | null {
  if (Array.isArray(body.messages) && body.messages.length > 0) {
    const messages = body.messages
      .map(normalizeTurn)
      .filter((m): m is ApartmentChatTurn => m != null)
      .slice(-MAX_APARTMENT_CHAT_TURNS);
    if (messages.length === 0 || messages[messages.length - 1]?.role !== "user") {
      return null;
    }
    return messages;
  }

  const message = String(body.message ?? "").trim();
  if (!message || message.length > MAX_APARTMENT_CHAT_MESSAGE_LENGTH) {
    return null;
  }

  const history = (body.history ?? [])
    .map(normalizeTurn)
    .filter((m): m is ApartmentChatTurn => m != null)
    .slice(-(MAX_APARTMENT_CHAT_TURNS - 1));

  return [
    ...history,
    { role: "user", content: message.slice(0, MAX_APARTMENT_CHAT_MESSAGE_LENGTH) },
  ];
}
