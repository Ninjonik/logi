import { NextResponse } from "next/server";

import { getPublicMatch } from "@/lib/read-models/public-profiles";
import { checkPublicApiRateLimit } from "@/lib/public-api";

export async function GET(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const limit = await checkPublicApiRateLimit(`public:${request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"}`, 30);
  if (!limit.allowed) return NextResponse.json({ error: { code: "rate_limited", message: "Too many requests." } }, { status: 429, headers: { "Retry-After": String(Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000))) } });
  const { eventId } = await params;
  const data = await getPublicMatch(eventId);
  return data ? NextResponse.json({ data }, { headers: { "Cache-Control": "public, max-age=60" } }) : NextResponse.json({ error: { code: "not_found", message: "Match not found." } }, { status: 404 });
}
