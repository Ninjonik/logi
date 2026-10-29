import { listPublicCompetitions } from "@/lib/read-models/competitions"
import { checkPublicApiRateLimit } from "@/lib/public-api"
export async function GET(request: Request) {
    const client =
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        "unknown"
    const limit = await checkPublicApiRateLimit(`public:${client}`, 60)
    if (!limit.allowed)
        return Response.json(
            { error: { code: "rate_limited", message: "Too many requests." } },
            {
                status: 429,
                headers: {
                    "Retry-After": String(
                        Math.max(
                            1,
                            Math.ceil((limit.resetAt - Date.now()) / 1000)
                        )
                    ),
                },
            }
        )
    try {
        return Response.json(
            { data: await listPublicCompetitions() },
            { headers: { "Cache-Control": "public, max-age=60" } }
        )
    } catch {
        return Response.json(
            {
                error: {
                    code: "unavailable",
                    message: "League catalogue unavailable.",
                },
            },
            { status: 503 }
        )
    }
}
