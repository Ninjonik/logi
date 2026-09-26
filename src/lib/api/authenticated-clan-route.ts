import { NextResponse } from "next/server"

import {
    authenticateClanApiKey,
    checkPublicApiRateLimit,
    hashApiKey,
    rateLimitHeaders,
    readBearerToken,
} from "@/lib/public-api"

export type AuthenticatedClanRequest = {
    key: string
    guildId: string
    headers: Record<string, string>
}

/** Performs the same authentication and rate-limit response handling for every clan route. */
export async function authenticateClanRequest(
    request: Request
): Promise<AuthenticatedClanRequest | NextResponse> {
    return await authenticateClanRequestWith(request, {
        readBearerToken,
        hashApiKey,
        checkRateLimit: checkPublicApiRateLimit,
        authenticateKey: authenticateClanApiKey,
        rateLimitHeaders,
    })
}

export async function authenticateClanRequestWith(
    request: Request,
    dependencies: {
        readBearerToken: (request: Request) => string | null
        hashApiKey: (key: string) => string
        checkRateLimit: (
            bucket: string,
            limit: number
        ) => Promise<{ allowed: boolean; remaining: number; resetAt: number }>
        authenticateKey: (key: string) => Promise<{ guildId: string } | null>
        rateLimitHeaders: (result: {
            remaining: number
            resetAt: number
        }) => Record<string, string>
    }
): Promise<AuthenticatedClanRequest | NextResponse> {
    const key = dependencies.readBearerToken(request)
    if (!key)
        return NextResponse.json(
            {
                error: {
                    code: "missing_api_key",
                    message: "Use Authorization: Bearer <API key>.",
                },
            },
            { status: 401 }
        )
    const rateLimit = await dependencies.checkRateLimit(
        `key:${dependencies.hashApiKey(key)}`,
        300
    )
    const headers = dependencies.rateLimitHeaders(rateLimit)
    if (!rateLimit.allowed)
        return NextResponse.json(
            { error: { code: "rate_limited", message: "Too many requests." } },
            {
                status: 429,
                headers: {
                    ...headers,
                    "Retry-After": String(
                        Math.max(
                            1,
                            Math.ceil((rateLimit.resetAt - Date.now()) / 1000)
                        )
                    ),
                },
            }
        )
    const authenticated = await dependencies.authenticateKey(key)
    if (!authenticated)
        return NextResponse.json(
            {
                error: {
                    code: "invalid_api_key",
                    message: "The API key is invalid or revoked.",
                },
            },
            { status: 401, headers }
        )
    return { key, guildId: authenticated.guildId, headers }
}

export function isAuthError(
    value: AuthenticatedClanRequest | NextResponse
): value is NextResponse {
    return value instanceof NextResponse
}
