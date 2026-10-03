import {
    parseWarconQuery,
    type WarconQuery,
} from "../../domain/game-data/warcon-query"
import { warconEnvelopeSchema } from "../../domain/game-data/warcon-contracts"
import type { WarconServed } from "../../application/game-data/read-warcon"

export async function warconRouteResponse(
    request: Request,
    read: (input: WarconQuery) => Promise<WarconServed>,
    headers: Record<string, string> = {}
) {
    const responseHeaders = { ...headers, "Cache-Control": "no-store" }
    const error = (code: string, status: number, retryAfterMs?: number) =>
        Response.json(
            {
                error: {
                    code,
                    message: "Warcon data is unavailable or not permitted.",
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
    const query = parseWarconQuery(new URL(request.url).searchParams)
    if (!query) return error("invalid_query", 400)
    try {
        const result = await read(query)
        if (result.kind === "denied") return error("insufficient_scope", 403)
        if (result.kind === "busy")
            return error("rate_limited", 429, result.retryAfterMs)
        if (result.kind === "failed")
            return error(
                `provider_${result.errorCategory}`,
                result.errorCategory === "rate_limited" ? 429 : 503,
                result.retryAfterMs
            )
        return Response.json(
            { data: warconEnvelopeSchema.parse(result.envelope) },
            { headers: responseHeaders }
        )
    } catch {
        return error("warcon_unavailable", 503)
    }
}
