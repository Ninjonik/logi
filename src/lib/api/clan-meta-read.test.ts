import assert from "node:assert/strict"
import test from "node:test"

import { readClanApiMeta, type ClanMetaRead } from "./clan-meta-read"
import { CLAN_META_INTERVAL_MS } from "@/domain/api/clan-meta"
import { createPublicApiMemory } from "./public-api-memory"

const NOW = Date.parse("2026-10-06T12:00:00.000Z")
const counts = {
    events: 3,
    groups: 1,
    rosters: 2,
    assignments: 4,
    users: 4,
    "calendar-items": 0,
    stratmaps: 0,
    "topic-presets": 0,
    "squad-presets": 0,
    matches: 1,
    articles: 0,
    settings: 1,
    "api-keys": 1,
}
const stored = (computedAt: string | null): ClanMetaRead => ({
    guild: { id: "guilds:a", guildId: "guild-a", name: "Fixture" },
    enabledGames: ["wardogs"],
    counts: computedAt ? counts : null,
    computedAt,
    updatedAt: "2026-10-06T11:59:00.000Z",
})

function harness(read: ClanMetaRead | null, clock = NOW) {
    const memory = createPublicApiMemory()
    const refreshes: Array<Promise<unknown>> = []
    const refreshedAt = new Date(clock).toISOString()
    return {
        refreshes,
        ports: {
            read: async () => read,
            refresh: () => {
                const result = Promise.resolve({
                    counts: { ...counts, events: 99 },
                    computedAt: refreshedAt,
                })
                refreshes.push(result)
                return result
            },
            claimRefresh: (guildId: string, now: number) =>
                memory.claimClanMetaRefresh(guildId, now),
            now: () => clock,
        },
    }
}

test("a rejected key reads as null without a refresh", async () => {
    const { ports, refreshes } = harness(null)
    assert.equal(await readClanApiMeta(ports), null)
    assert.equal(refreshes.length, 0)
})

test("a clan without a summary answers from a synchronous refresh", async () => {
    const { ports, refreshes } = harness(stored(null))
    const meta = await readClanApiMeta(ports)
    assert.equal(refreshes.length, 1)
    assert.deepEqual(meta, {
        guild: { id: "guilds:a", guildId: "guild-a", name: "Fixture" },
        enabledGames: ["wardogs"],
        counts: { ...counts, events: 99 },
        computedAt: new Date(NOW).toISOString(),
        updatedAt: "2026-10-06T11:59:00.000Z",
    })
})

test("a key the refresh rejects reads as null", async () => {
    const { ports } = harness(stored(null))
    assert.equal(
        await readClanApiMeta({ ...ports, refresh: async () => null }),
        null
    )
})

test("a fresh summary is served as stored and triggers nothing", async () => {
    const computedAt = new Date(NOW - 10_000).toISOString()
    const { ports, refreshes } = harness(stored(computedAt))
    const meta = await readClanApiMeta(ports)
    assert.deepEqual(meta?.counts, counts)
    assert.equal(meta?.computedAt, computedAt)
    assert.equal(refreshes.length, 0)
})

test("a stale summary is served as stored while one refresh per clan and interval runs off the request path", async () => {
    const computedAt = new Date(NOW - CLAN_META_INTERVAL_MS).toISOString()
    const { ports, refreshes } = harness(stored(computedAt))
    const first = await readClanApiMeta(ports)
    const second = await readClanApiMeta(ports)
    assert.deepEqual(first?.counts, counts)
    assert.equal(first?.computedAt, computedAt)
    assert.deepEqual(second, first)
    assert.equal(refreshes.length, 1)
    await Promise.all(refreshes)
})

test("a failing background refresh never fails the request", async () => {
    const computedAt = new Date(NOW - CLAN_META_INTERVAL_MS).toISOString()
    const { ports } = harness(stored(computedAt))
    const meta = await readClanApiMeta({
        ...ports,
        refresh: () => Promise.reject(new Error("backend down")),
    })
    assert.deepEqual(meta?.counts, counts)
    await new Promise((resolve) => setImmediate(resolve))
})
