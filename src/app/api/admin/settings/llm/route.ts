import { NextResponse } from "next/server";
import { getLlmSettingsPublic, updateLlmSettings } from "@/lib/llm-settings";
import { getSessionUser, isAdmin } from "@/lib/auth";

async function requireAdminUser() {
  const user = await getSessionUser();
  if (!user || !isAdmin(user)) return null;
  return user;
}

export async function GET() {
  if (!(await requireAdminUser())) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const settings = await getLlmSettingsPublic();
    return NextResponse.json(settings);
  } catch (err) {
    console.error("LLM settings read failed:", err);
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  if (!(await requireAdminUser())) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  let body: { baseUrl?: string; apiKey?: string; model?: string; systemPrompt?: string };
  try {
    body = (await req.json()) as {
      baseUrl?: string;
      apiKey?: string;
      model?: string;
      systemPrompt?: string;
    };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (
    body.baseUrl === undefined &&
    body.apiKey === undefined &&
    body.model === undefined &&
    body.systemPrompt === undefined
  ) {
    return NextResponse.json({ error: "no_fields" }, { status: 400 });
  }

  try {
    const saved = await updateLlmSettings({
      ...(body.baseUrl !== undefined ? { baseUrl: String(body.baseUrl ?? "") } : {}),
      ...(body.apiKey !== undefined ? { apiKey: String(body.apiKey ?? "") } : {}),
      ...(body.model !== undefined ? { model: String(body.model ?? "") } : {}),
      ...(body.systemPrompt !== undefined
        ? { systemPrompt: String(body.systemPrompt ?? "") }
        : {}),
    });
    return NextResponse.json(saved);
  } catch (err) {
    const message = err instanceof Error ? err.message : "update_failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
