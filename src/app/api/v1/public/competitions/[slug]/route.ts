import { NextResponse } from "next/server";
import { getPublicCompetition } from "@/lib/read-models/competitions";
import { checkPublicApiRateLimit } from "@/lib/public-api";

function clientBucket(request: Request) { return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"; }
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const limit = await checkPublicApiRateLimit(`public:${clientBucket(request)}`, 60);
  if (!limit.allowed) return NextResponse.json({ error: { code: "rate_limited", message: "Too many requests." } }, { status: 429, headers: { "Retry-After": String(Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000))) } });
  const { slug } = await params;
  const data = await getPublicCompetition(slug);
  return data ? NextResponse.json({ data }, { headers: { "Cache-Control": "public, max-age=60" } }) : NextResponse.json({ error: { code: "not_found", message: "Competition not found." } }, { status: 404 });
}
