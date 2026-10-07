import { publicApiMemory, type PublicApiMemory } from "./public-api-memory"

/**
 * Hard aggregate ceiling for the externally consumed API. This lives at the
 * `/api/v1` boundary, so dashboard routes do not consume its budget.
 */
export const EXTERNAL_API_REQUESTS_PER_SECOND = 60
const EXTERNAL_API_WINDOW_MS = 1_000
const EXTERNAL_API_BUCKET = "external-api"

type RateLimitStore = Pick<PublicApiMemory, "takeToken">

export function checkExternalApiRateLimit(
    memory: RateLimitStore = publicApiMemory,
    now = Date.now()
) {
    return memory.takeToken(
        EXTERNAL_API_BUCKET,
        EXTERNAL_API_REQUESTS_PER_SECOND,
        EXTERNAL_API_WINDOW_MS,
        now
    )
}

export function externalApiRateLimitResponse(result: {
    remaining: number
    resetAt: number
}) {
    return Response.json(
        { error: { code: "rate_limited", message: "Too many requests." } },
        {
            status: 429,
            headers: {
                "RateLimit-Limit": String(EXTERNAL_API_REQUESTS_PER_SECOND),
                "RateLimit-Remaining": String(result.remaining),
                "RateLimit-Reset": String(Math.ceil(result.resetAt / 1_000)),
                "Retry-After": String(
                    Math.max(
                        1,
                        Math.ceil((result.resetAt - Date.now()) / 1_000)
                    )
                ),
            },
        }
    )
}
