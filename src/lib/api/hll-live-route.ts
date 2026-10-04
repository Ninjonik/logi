import type { HllServed } from "../../application/game-data/read-hll-live"
import { hllLiveEnvelopeSchema } from "../../domain/game-data/hll-live"
export async function hllLiveRouteResponse(
    request: Request,
    read: () => Promise<HllServed>,
    headers: Record<string, string> = {}
) {
    const responseHeaders = { ...headers, "Cache-Control": "no-store" }
    const error = (code: string, status: number, retryAfterMs?: number) =>
        Response.json(
            {
                error: {
                    code,
                    message: "HLL live data is unavailable or not permitted.",
                },
            },
            {
                status,
                headers: {
                    ...responseHeaders,
                    ...(retryAfterMs
                        ? {
                              "Retry-After": String(
                                  Math.max(1, Math.ceil(retryAfterMs / 1000))
                              ),
                          }
                        : {}),
                },
            }
        )
    if (new URL(request.url).search) return error("invalid_query", 400)
    try {
        const result = await read()
        if (result.kind === "denied") return error("insufficient_scope", 403)
        if (result.kind === "busy")
            return error("rate_limited", 429, result.retryAfterMs)
        return Response.json(
            { data: hllLiveEnvelopeSchema.parse(result.envelope) },
            { headers: responseHeaders }
        )
    } catch {
        return error("hll_live_unavailable", 503)
    }
}
