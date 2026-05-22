import { NextResponse } from "next/server";
import { getApartmentLlmBundle } from "@/lib/apartment-llm-data";
import { answerApartmentLlmQuestion } from "@/lib/llm-apartment-chat";
import { getSessionUser } from "@/lib/auth";
import { isLlmConfigured } from "@/lib/llm-client";

const MAX_MESSAGE_LENGTH = 4000;
const MAX_HISTORY_TURNS = 12;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ apartmentId: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { apartmentId } = await params;
  const bundle = await getApartmentLlmBundle(apartmentId, user);
  if (!bundle) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (!(await isLlmConfigured())) {
    return NextResponse.json({ error: "llm_not_configured" }, { status: 503 });
  }

  let body: { message?: string; history?: { role: string; content: string }[] };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const message = String(body.message ?? "").trim();
  if (!message || message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json({ error: "invalid_message" }, { status: 400 });
  }

  const history = (body.history ?? [])
    .filter(
      (m) =>
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim()
    )
    .slice(-MAX_HISTORY_TURNS)
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content.trim().slice(0, MAX_MESSAGE_LENGTH),
    }));

  const result = await answerApartmentLlmQuestion({
    apartment: bundle.apartment,
    messages: [...history, { role: "user", content: message }],
  });

  if (!result.ok) {
    const status =
      result.error === "no_source_text" ? 422 : result.error === "not_configured" ? 503 : 502;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({
    ok: true,
    answer: result.answer,
    webSearchEnabled: result.webSearchEnabled,
    webSearchUsed: result.webSearchUsed,
  });
}
