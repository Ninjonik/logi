import { collectSessions, type HistoryProgress } from "./collect-sessions"
import type { ProviderSession } from "../../domain/game-data/contracts"
import assert from "node:assert/strict"
import test from "node:test"
const session: ProviderSession = {
    externalId: "42",
    startedAt: null,
    endedAt: null,
    complete: false,
    map: null,
    participants: [],
    players: [],
    sourceDigest: "a".repeat(64),
}
const initial: HistoryProgress = { page: 1, pendingIds: [], nextPage: null }
test("history commits one session and its remaining page checkpoint together", async () => {
    let saved: unknown
    const result = await collectSessions(initial, {
        readPage: async () => ({ ids: ["42", "43"], nextPage: 2 }),
        readSession: async (id) => {
            assert.equal(id, "42")
            return session
        },
        commit: async (value) => {
            saved = value
            return true
        },
    })
    assert.equal(result, "continued")
    assert.deepEqual(saved, {
        session,
        progress: { page: 1, pendingIds: ["43"], nextPage: 2 },
        completed: false,
    })
})
test("crash before commit replays the pending ID without losing it or refetching the page", async () => {
    const progress: HistoryProgress = {
        page: 1,
        pendingIds: ["42"],
        nextPage: 2,
    }
    const port = {
        readPage: async () => {
            throw new Error("Page should not be read")
        },
        readSession: async () => session,
    }
    await assert.rejects(
        collectSessions(progress, {
            ...port,
            commit: async () => {
                throw new Error("storage unavailable")
            },
        }),
        /storage unavailable/
    )
    let resumed: unknown
    await collectSessions(progress, {
        ...port,
        commit: async (value) => {
            resumed = value
            return true
        },
    })
    assert.deepEqual(resumed, {
        session,
        progress: { page: 2, pendingIds: [], nextPage: null },
        completed: false,
    })
})
test("new head and overlapping pages cannot overwrite identities or skip the next full sweep", async () => {
    const collected = new Map<string, ProviderSession>()
    let current = initial
    let sweep = 0
    const pages = [
        ["42", "41"],
        ["41", "40"],
    ]
    for (let step = 0; step < 4; step++) {
        await collectSessions(current, {
            readPage: async (page) => ({
                ids: pages[page - 1],
                nextPage: page === 1 ? 2 : null,
            }),
            readSession: async (id) => ({ ...session, externalId: id }),
            commit: async ({ session: value, progress, completed }) => {
                if (value) collected.set(value.externalId, value)
                current = progress
                if (completed) sweep++
                return true
            },
        })
    }
    assert.deepEqual([...collected.keys()], ["42", "41", "40"])
    assert.equal(sweep, 1)
    assert.equal(current.page, 1)
    await collectSessions(current, {
        readPage: async () => ({ ids: ["43", "42"], nextPage: null }),
        readSession: async (id) => ({ ...session, externalId: id }),
        commit: async ({ session: value }) => {
            if (value) collected.set(value.externalId, value)
            return true
        },
    })
    assert.ok(collected.has("43"))
    assert.equal(collected.size, 4)
})
