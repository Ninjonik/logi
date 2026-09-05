import { NextResponse } from "next/server";

import { checkPublicApiRateLimit, getClanApiData, hashApiKey, rateLimitHeaders, readBearerToken } from "@/lib/public-api";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const key = readBearerToken(request);
  if (!key) return NextResponse.json({ error: { code: "missing_api_key", message: "Use Authorization: Bearer <API key>." } }, { status: 401 });
  const limit = await checkPublicApiRateLimit(`key:${hashApiKey(key)}`, 300);
  const headers = rateLimitHeaders(limit);
  if (!limit.allowed) return NextResponse.json({ error: { code: "rate_limited", message: "Too many requests." } }, { status: 429, headers: { ...headers, "Retry-After": String(Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000))) } });
  const data = await getClanApiData(key);
  if (!data) return NextResponse.json({ error: { code: "invalid_api_key", message: "The API key is invalid or revoked." } }, { status: 401, headers });
  return NextResponse.json({ data }, { headers: { ...headers, "Cache-Control": "private, max-age=30" } });
}
