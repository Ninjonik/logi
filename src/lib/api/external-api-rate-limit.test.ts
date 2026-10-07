import assert from "node:assert/strict"
import test from "node:test"

import {
    checkExternalApiRateLimit,
    EXTERNAL_API_REQUESTS_PER_SECOND,
} from "./external-api-rate-limit"
import { createPublicApiMemory } from "./public-api-memory"

test("each external API client IP has its own 60-request-per-second budget", () => {
    const memory = createPublicApiMemory()
    for (let count = 0; count < EXTERNAL_API_REQUESTS_PER_SECOND; count++)
        assert.equal(
            checkExternalApiRateLimit("203.0.113.10", memory, 1_000).allowed,
            true
        )

    const refused = checkExternalApiRateLimit("203.0.113.10", memory, 1_000)
    assert.deepEqual(refused, {
        allowed: false,
        remaining: 0,
        resetAt: 2_000,
    })
    assert.equal(
        checkExternalApiRateLimit("203.0.113.11", memory, 1_000).allowed,
        true
    )
    assert.equal(
        checkExternalApiRateLimit("203.0.113.10", memory, 2_000).allowed,
        true
    )
})
