import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { fetchListingPreview } from "@/lib/listing-import";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { url?: string };
  try {
    body = (await req.json()) as { url?: string };
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const url = String(body.url ?? "").trim();
  if (!url) {
    return NextResponse.json({ error: "missing_url" }, { status: 400 });
  }

  const result = await fetchListingPreview(url);
  if (!result.ok) {
    return NextResponse.json(result, { status: 422 });
  }

  return NextResponse.json(result);
}
