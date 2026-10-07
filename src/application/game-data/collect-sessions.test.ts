import {
    collectSessions,
    type HistoryCommit,
    type HistoryProgress,
} from "./collect-sessions"
import {
    ProviderError,
    type ProviderSession,
} from "../../domain/game-data/contracts"
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
const full = { fullWalk: true }
const incremental = { fullWalk: false }
const nothingStored = async () => [] as string[]
test("history commits one session and its remaining page checkpoint together", async () => {
    let saved: unknown
    const result = await collectSessions(
        initial,
        {
            readPage: async () => ({ ids: ["42", "43"], nextPage: 2 }),
            storedComplete: nothingStored,
            readSession: async (id) => {
                assert.equal(id, "42")
                return session
            },
            commit: async (value) => {
                saved = value
                return true
            },
        },
        full
    )
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
        storedComplete: async (): Promise<string[]> => {
            throw new Error("Pending IDs need no lookup")
        },
        readSession: async () => session,
    }
    await assert.rejects(
        collectSessions(
            progress,
            {
                ...port,
                commit: async () => {
                    throw new Error("storage unavailable")
                },
            },
            incremental
        ),
        /storage unavailable/
    )
    let resumed: unknown
    await collectSessions(
        progress,
        {
            ...port,
            commit: async (value) => {
                resumed = value
                return true
            },
        },
        incremental
    )
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
        await collectSessions(
            current,
            {
                readPage: async (page) => ({
                    ids: pages[page - 1],
                    nextPage: page === 1 ? 2 : null,
                }),
                storedComplete: nothingStored,
                readSession: async (id) => ({ ...session, externalId: id }),
                commit: async ({ session: value, progress, completed }) => {
                    if (value) collected.set(value.externalId, value)
                    current = progress
                    if (completed) sweep++
                    return true
                },
            },
            full
        )
    }
    assert.deepEqual([...collected.keys()], ["42", "41", "40"])
    assert.equal(sweep, 1)
    assert.equal(current.page, 1)
    await collectSessions(
        current,
        {
            readPage: async () => ({ ids: ["43", "42"], nextPage: null }),
            storedComplete: nothingStored,
            readSession: async (id) => ({ ...session, externalId: id }),
            commit: async ({ session: value }) => {
                if (value) collected.set(value.externalId, value)
                return true
            },
        },
        full
    )
    assert.ok(collected.has("43"))
    assert.equal(collected.size, 4)
})
test("a session the provider no longer serves is skipped instead of blocking newer history", async () => {
    let saved: unknown
    const result = await collectSessions(
        { page: 1, pendingIds: ["gone", "43"], nextPage: null },
        {
            readPage: async () => {
                throw new Error("Page should not be read")
            },
            storedComplete: nothingStored,
            readSession: async () => {
                throw new ProviderError("invalid_response")
            },
            commit: async (value) => {
                saved = value
                return true
            },
        },
        full
    )
    assert.equal(result, "continued")
    assert.deepEqual(saved, {
        session: null,
        progress: { page: 1, pendingIds: ["43"], nextPage: null },
        completed: false,
    })
    await assert.rejects(
        collectSessions(
            { page: 1, pendingIds: ["42"], nextPage: null },
            {
                readPage: async () => ({ ids: [], nextPage: null }),
                storedComplete: nothingStored,
                readSession: async () => {
                    throw new ProviderError("rate_limited", 1000)
                },
                commit: async () => true,
            },
            full
        ),
        /rate_limited/
    )
})
/** A provider and store fake that counts provider calls and commits. */
function counted(input: {
    pages: string[][]
    stored: string[]
    commit?: (value: HistoryCommit) => boolean
}) {
    const calls = { pages: [] as number[], sessions: [] as string[] }
    const commits: HistoryCommit[] = []
    const ports = {
        readPage: async (page: number) => {
            calls.pages.push(page)
            return {
                ids: input.pages[page - 1] ?? [],
                nextPage: page < input.pages.length ? page + 1 : null,
            }
        },
        storedComplete: async (ids: string[]) =>
            ids.filter((id) => input.stored.includes(id)),
        readSession: async (id: string) => {
            calls.sessions.push(id)
            return { ...session, externalId: id, complete: true }
        },
        commit: async (value: HistoryCommit) => {
            commits.push(value)
            return input.commit?.(value) ?? true
        },
    }
    return { calls, commits, ports }
}
test("a caught-up page ends an incremental cycle without reading a session", async () => {
    const { calls, commits, ports } = counted({
        pages: [
            ["45", "44", "43"],
            ["42", "41"],
        ],
        stored: ["45", "44", "43", "42", "41"],
    })
    assert.equal(
        await collectSessions(initial, ports, incremental),
        "completed"
    )
    assert.deepEqual(calls, { pages: [1], sessions: [] })
    assert.deepEqual(commits, [
        { session: null, progress: initial, completed: true },
    ])
})
test("an incremental cycle reads only the new session of a page, then stops at the next stored page", async () => {
    const { calls, commits, ports } = counted({
        pages: [
            ["46", "45", "44"],
            ["43", "42"],
            ["41", "40"],
        ],
        stored: ["45", "44", "43", "42", "41", "40"],
    })
    let progress = initial
    const results: string[] = []
    for (let step = 0; step < 2; step++) {
        results.push(await collectSessions(progress, ports, incremental))
        progress = commits.at(-1)!.progress
    }
    assert.deepEqual(results, ["continued", "completed"])
    assert.deepEqual(calls, { pages: [1, 2], sessions: ["46"] })
    assert.equal(commits[0].session?.externalId, "46")
    assert.deepEqual(commits[0].progress, {
        page: 2,
        pendingIds: [],
        nextPage: null,
    })
    assert.deepEqual(commits[1], {
        session: null,
        progress: initial,
        completed: true,
    })
})
test("several new sessions of one page stay pending one per step without the stored ones", async () => {
    const { calls, commits, ports } = counted({
        pages: [["46", "45", "44", "43"], ["42"]],
        stored: ["44", "43", "42"],
    })
    await collectSessions(initial, ports, incremental)
    assert.deepEqual(commits[0].progress, {
        page: 1,
        pendingIds: ["45"],
        nextPage: 2,
    })
    await collectSessions(commits[0].progress, ports, incremental)
    assert.deepEqual(calls.sessions, ["46", "45"])
    assert.deepEqual(calls.pages, [1], "pending IDs need no page read")
})
test("a full walk re-reads every stored session to the last page", async () => {
    const { calls, commits, ports } = counted({
        pages: [["45", "44"], ["43"]],
        stored: ["45", "44", "43"],
    })
    let progress = initial
    let result = ""
    while (result !== "completed") {
        result = await collectSessions(progress, ports, full)
        progress = commits.at(-1)!.progress
    }
    assert.deepEqual(calls, { pages: [1, 2], sessions: ["45", "44", "43"] })
    assert.equal(commits.length, 3)
})
test("a caught-up commit refused by a newer claim reports the stale fence", async () => {
    const { ports } = counted({
        pages: [["45"]],
        stored: ["45"],
        commit: () => false,
    })
    assert.equal(
        await collectSessions(initial, ports, incremental),
        "stale_fence"
    )
})
