import { NextResponse } from "next/server";
import { checkPublicApiRateLimit, getClanApiData, hashApiKey, readBearerToken } from "@/lib/public-api";
import { isCollectionQueryError, parseCollectionQuery } from "@/lib/api/collection-query";
import { filterCollection, paginateCollection } from "@/domain/shared/collection-query";

export async function GET(request: Request) {
  const key = readBearerToken(request);
  if (!key) return NextResponse.json({ error: { code: "missing_api_key", message: "Use Authorization: Bearer <API key>." } }, { status: 401 });
  const rateLimit = await checkPublicApiRateLimit(`key:${hashApiKey(key)}`, 300);
  if (!rateLimit.allowed) return NextResponse.json({ error: { code: "rate_limited", message: "Too many requests." } }, { status: 429 });
  const query = parseCollectionQuery(request);
  if (isCollectionQueryError(query)) return NextResponse.json({ error: { code: "invalid_query", message: query.error } }, { status: 400 });
  const data = await getClanApiData(key) as { articles?: Array<Record<string, unknown>> } | null;
  if (!data) return NextResponse.json({ error: { code: "invalid_api_key", message: "The API key is invalid or revoked." } }, { status: 401 });
  return NextResponse.json({ data: paginateCollection(filterCollection(data.articles ?? [], query.filters), query.offset, query.limit) });
}
