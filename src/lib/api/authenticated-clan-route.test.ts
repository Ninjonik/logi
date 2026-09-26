import assert from "node:assert/strict"
import test from "node:test"

import {
    authenticateClanRequestWith,
    isAuthError,
} from "./authenticated-clan-route"

function createDependencies(
    overrides: Partial<Parameters<typeof authenticateClanRequestWith>[1]> = {}
) {
    return {
        readBearerToken: (request: Request) => {
            const value = request.headers.get("authorization")
            return value?.startsWith("Bearer ") ? value.slice(7) : null
        },
        hashApiKey: (key: string) => `hash:${key}`,
        checkRateLimit: async () => ({
            allowed: true,
            remaining: 299,
            resetAt: 1_700_000_060_000,
        }),
        authenticateKey: async () => ({ guildId: "guild-1" }),
        rateLimitHeaders: (result: { remaining: number; resetAt: number }) => ({
            "RateLimit-Limit": "300",
            "RateLimit-Remaining": String(result.remaining),
            "RateLimit-Reset": String(Math.ceil(result.resetAt / 1_000)),
        }),
        ...overrides,
    }
}

test("clan authentication rejects missing and malformed bearer credentials before persistence calls", async () => {
    for (const authorization of [undefined, "Basic abc", "Bearer "]) {
        let rateLimitCalls = 0
        const response = await authenticateClanRequestWith(
            new Request("https://logi.test/api/v1/clan/meta", {
                ...(authorization ? { headers: { authorization } } : {}),
            }),
            createDependencies({
                checkRateLimit: async () => {
                    rateLimitCalls += 1
                    return { allowed: true, remaining: 299, resetAt: 0 }
                },
            })
        )
        assert.equal(isAuthError(response), true)
        if (isAuthError(response)) {
            assert.equal(response.status, 401)
            assert.equal((await response.json()).error.code, "missing_api_key")
        }
        assert.equal(rateLimitCalls, 0)
    }
})

test("clan authentication returns rate-limit headers for revoked keys", async () => {
    const response = await authenticateClanRequestWith(
        new Request("https://logi.test/api/v1/clan/meta", {
            headers: { authorization: "Bearer logi_revoked" },
        }),
        createDependencies({ authenticateKey: async () => null })
    )

    assert.equal(isAuthError(response), true)
    if (isAuthError(response)) {
        assert.equal(response.status, 401)
        assert.deepEqual(await response.json(), {
            error: {
                code: "invalid_api_key",
                message: "The API key is invalid or revoked.",
            },
        })
        assert.equal(response.headers.get("RateLimit-Limit"), "300")
        assert.equal(response.headers.get("RateLimit-Remaining"), "299")
    }
})

test("clan authentication returns rate-limit headers and retry timing when limited", async () => {
    const response = await authenticateClanRequestWith(
        new Request("https://logi.test/api/v1/clan/meta", {
            headers: { authorization: "Bearer logi_limited" },
        }),
        createDependencies({
            checkRateLimit: async () => ({
                allowed: false,
                remaining: 0,
                resetAt: Date.now() + 5_000,
            }),
        })
    )

    assert.equal(isAuthError(response), true)
    if (isAuthError(response)) {
        assert.equal(response.status, 429)
        assert.equal((await response.json()).error.code, "rate_limited")
        assert.equal(response.headers.get("RateLimit-Remaining"), "0")
        assert.match(response.headers.get("Retry-After") ?? "", /^[1-9]\d*$/)
    }
})

test("clan authentication returns the key owner after applying the rate limit", async () => {
    const response = await authenticateClanRequestWith(
        new Request("https://logi.test/api/v1/clan/meta", {
            headers: { authorization: "Bearer logi_valid" },
        }),
        createDependencies()
    )

    assert.equal(isAuthError(response), false)
    if (!isAuthError(response)) {
        assert.deepEqual(response, {
            key: "logi_valid",
            guildId: "guild-1",
            headers: {
                "RateLimit-Limit": "300",
                "RateLimit-Remaining": "299",
                "RateLimit-Reset": "1700000060",
            },
        })
    }
})
