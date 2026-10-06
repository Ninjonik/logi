import assert from "node:assert/strict"
import test from "node:test"

import { createPublicApiMemory } from "./public-api-memory"

test("rate-limit windows are kept per bucket in memory", () => {
    const memory = createPublicApiMemory()
    const first = memory.takeToken("key:a", 2, 60_000, 1_000)
    assert.deepEqual(first, { allowed: true, remaining: 1, resetAt: 61_000 })
    assert.equal(memory.takeToken("key:a", 2, 60_000, 2_000).allowed, true)
    assert.equal(memory.takeToken("key:a", 2, 60_000, 3_000).allowed, false)
    assert.equal(memory.takeToken("key:b", 2, 60_000, 3_000).allowed, true)
    assert.equal(memory.takeToken("key:a", 2, 60_000, 61_000).allowed, true)
})

test("a key's use is claimed once per interval per process", () => {
    const memory = createPublicApiMemory()
    assert.equal(memory.claimKeyUse("hash", 1_000, 5_000), true)
    assert.equal(memory.claimKeyUse("hash", 2_000, 5_000), false)
    assert.equal(memory.claimKeyUse("other", 2_000, 5_000), true)
    assert.equal(memory.claimKeyUse("hash", 6_000, 5_000), true)
})

test("expired entries are dropped once the memory grows large", () => {
    const memory = createPublicApiMemory()
    for (let n = 0; n < 10_001; n++) memory.takeToken(`key:${n}`, 5, 1_000, 0)
    assert.equal(memory.size(), 10_001)
    memory.takeToken("key:late", 5, 1_000, 5_000)
    assert.equal(memory.size(), 1)
})

test("a clan's meta refresh is claimed once per interval per process", () => {
    const memory = createPublicApiMemory()
    assert.equal(memory.claimClanMetaRefresh("guild-a", 1_000, 60_000), true)
    assert.equal(memory.claimClanMetaRefresh("guild-a", 30_000, 60_000), false)
    assert.equal(memory.claimClanMetaRefresh("guild-b", 30_000, 60_000), true)
    assert.equal(memory.claimClanMetaRefresh("guild-a", 61_000, 60_000), true)
    // The meta claims never block a key's own use mark.
    assert.equal(memory.claimKeyUse("guild-a", 61_000, 5_000), true)
})
