import { NextResponse } from "next/server";

import { listPublicMatches } from "@/lib/read-models/public-profiles";
import { checkPublicApiRateLimit } from "@/lib/public-api";

export async function GET(request: Request) {
  const limit = await checkPublicApiRateLimit(`public:${request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"}`, 60);
  if (!limit.allowed) return NextResponse.json({ error: { code: "rate_limited", message: "Too many requests." } }, { status: 429, headers: { "Retry-After": String(Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000))) } });
  const cursor = new URL(request.url).searchParams.get("cursor");
  return NextResponse.json({ data: await listPublicMatches(cursor) }, { headers: { "Cache-Control": "public, max-age=60" } });
}
