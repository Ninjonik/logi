import { pruneExpired } from "../../../convex/apiHousekeeping"
import { invoke, testContext } from "./testing/database"
import assert from "node:assert/strict"
import test from "node:test"

test("expired idempotency keys and rate-limit windows are removed in bounded batches, live ones stay", async () => {
    const ctx = testContext()
    const now = Date.now()
    for (let i = 0; i < 251; i++)
        ctx.db.seed("apiIdempotencyKeys", {
            _id: `apiIdempotencyKeys:expired-${i}`,
            guildId: "guild-a",
            key: `k-${i}`,
            methodPath: "POST /clan/events",
            bodyHash: "h",
            status: 200,
            responseBody: "{}",
            createdAt: new Date(now - 90_000_000).toISOString(),
            expiresAt: now - 1,
        })
    ctx.db.seed("apiIdempotencyKeys", {
        _id: "apiIdempotencyKeys:live",
        guildId: "guild-a",
        key: "live",
        methodPath: "POST /clan/events",
        bodyHash: "h",
        status: 200,
        responseBody: "{}",
        createdAt: new Date(now).toISOString(),
        expiresAt: now + 60_000,
    })
    ctx.db.seed("apiRateLimitBuckets", {
        _id: "apiRateLimitBuckets:old",
        bucket: "old",
        count: 3,
        resetAt: now - 1,
    })
    ctx.db.seed("apiRateLimitBuckets", {
        _id: "apiRateLimitBuckets:open",
        bucket: "open",
        count: 1,
        resetAt: now + 60_000,
    })
    assert.deepEqual(await invoke(pruneExpired, ctx), {
        keys: 250,
        buckets: 1,
        more: true,
    })
    assert.equal(ctx.scheduler.calls.length, 1, "a full batch reschedules")
    assert.deepEqual(await invoke(pruneExpired, ctx), {
        keys: 1,
        buckets: 0,
        more: false,
    })
    assert.equal(ctx.scheduler.calls.length, 1)
    assert.deepEqual(
        ctx.db.tables.apiIdempotencyKeys.map((row) => row.key),
        ["live"]
    )
    assert.deepEqual(
        ctx.db.tables.apiRateLimitBuckets.map((row) => row.bucket),
        ["open"]
    )
})
