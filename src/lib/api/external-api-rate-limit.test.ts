import assert from "node:assert/strict"
import test from "node:test"

import {
    checkExternalApiRateLimit,
    externalApiRateLimitBucket,
    EXTERNAL_API_REQUESTS_PER_SECOND,
} from "./external-api-rate-limit"
import { createPublicApiMemory } from "./public-api-memory"

test("public external API requests are independently limited by client IP", () => {
    const memory = createPublicApiMemory()
    for (let count = 0; count < EXTERNAL_API_REQUESTS_PER_SECOND; count++)
        assert.equal(
            checkExternalApiRateLimit("ip:203.0.113.10", memory, 1_000).allowed,
            true
        )

    const refused = checkExternalApiRateLimit("ip:203.0.113.10", memory, 1_000)
    assert.deepEqual(refused, {
        allowed: false,
        remaining: 0,
        resetAt: 2_000,
    })
    assert.equal(
        checkExternalApiRateLimit("ip:203.0.113.11", memory, 1_000).allowed,
        true
    )
    assert.equal(
        checkExternalApiRateLimit("ip:203.0.113.10", memory, 2_000).allowed,
        true
    )
})

test("clan API requests share a budget by hashed bearer key across source IPs", () => {
    const first = new Request("https://logi.example/api/v1/clan/events", {
        headers: {
            authorization: "Bearer integration-key",
            "x-forwarded-for": "203.0.113.10",
        },
    })
    const second = new Request("https://logi.example/api/v1/clan/events", {
        headers: {
            authorization: "Bearer integration-key",
            "x-forwarded-for": "203.0.113.11",
        },
    })
    const otherKey = new Request("https://logi.example/api/v1/clan/events", {
        headers: { authorization: "Bearer another-key" },
    })
    const bucket = externalApiRateLimitBucket(first)
    assert.equal(bucket, externalApiRateLimitBucket(second))
    assert.notEqual(bucket, externalApiRateLimitBucket(otherKey))
    assert.equal(bucket.includes("integration-key"), false)

    const memory = createPublicApiMemory()
    for (let count = 0; count < EXTERNAL_API_REQUESTS_PER_SECOND; count++)
        assert.equal(
            checkExternalApiRateLimit(bucket, memory, 1_000).allowed,
            true
        )
    assert.equal(
        checkExternalApiRateLimit(
            externalApiRateLimitBucket(second),
            memory,
            1_000
        ).allowed,
        false
    )
    assert.equal(
        checkExternalApiRateLimit(
            externalApiRateLimitBucket(otherKey),
            memory,
            1_000
        ).allowed,
        true
    )
})
