import { NextResponse } from "next/server";

import { listPublicMatches } from "@/lib/read-models/public-profiles";
import { checkPublicApiRateLimit } from "@/lib/public-api";
import { isCollectionQueryError, parseCollectionQuery } from "@/lib/api/collection-query";

export async function GET(request: Request) {
  const limit = await checkPublicApiRateLimit(`public:${request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"}`, 60);
  if (!limit.allowed) return NextResponse.json({ error: { code: "rate_limited", message: "Too many requests." } }, { status: 429, headers: { "Retry-After": String(Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000))) } });
  const query = parseCollectionQuery(request);
  if (isCollectionQueryError(query)) return NextResponse.json({ error: { code: "invalid_query", message: query.error } }, { status: 400 });
  const cursor = new URL(request.url).searchParams.get("cursor") ?? (query.offset ? String(query.offset) : null);
  return NextResponse.json({ data: await listPublicMatches(cursor, query.limit, query.filters) }, { headers: { "Cache-Control": "public, max-age=60" } });
}
