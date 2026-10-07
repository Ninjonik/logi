import { createHash } from "node:crypto"

import { publicApiMemory, type PublicApiMemory } from "./public-api-memory"

/**
 * Per-client ceiling for the externally consumed API. This lives at the
 * `/api/v1` boundary, so dashboard routes do not consume its budget.
 */
export const EXTERNAL_API_REQUESTS_PER_SECOND = 60
const EXTERNAL_API_WINDOW_MS = 1_000
const EXTERNAL_API_BUCKET = "external-api"

type RateLimitStore = Pick<PublicApiMemory, "takeToken">

export function checkExternalApiRateLimit(
    bucket: string,
    memory: RateLimitStore = publicApiMemory,
    now = Date.now()
) {
    return memory.takeToken(
        `${EXTERNAL_API_BUCKET}:${bucket}`,
        EXTERNAL_API_REQUESTS_PER_SECOND,
        EXTERNAL_API_WINDOW_MS,
        now
    )
}

/** The first forwarded address is the client IP when the reverse proxy sanitizes it. */
export function externalApiClientIp(request: Request) {
    return (
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        request.headers.get("x-real-ip") ||
        "unknown"
    )
}

/**
 * Clan API requests are limited by the SHA-256 hash of their bearer key, so a
 * caller behind rotating Cloudflare addresses cannot acquire another budget.
 * Public endpoints have no key and remain limited by source IP.
 */
export function externalApiRateLimitBucket(request: Request) {
    if (new URL(request.url).pathname.startsWith("/api/v1/clan/")) {
        const authorization = request.headers.get("authorization")
        const key = authorization?.startsWith("Bearer ")
            ? authorization.slice(7).trim()
            : null
        if (key) return `key:${createHash("sha256").update(key).digest("hex")}`
    }
    return `ip:${externalApiClientIp(request)}`
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
