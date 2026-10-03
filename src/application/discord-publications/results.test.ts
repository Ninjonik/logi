import { synchronizeResults, type ResultEvent } from "./results"
import assert from "node:assert/strict"
import test from "node:test"

test("reviewed results publish once, correct the same binding, and withdraw without touching another feature", async () => {
    const panel = {
        id: "p",
        enabled: true,
        createdAt: 1000,
        channelId: "destination",
    }
    const result = {
        status: "confirmed",
        version: 1,
        reviewedAt: new Date(2000).toISOString(),
        participants: [{ label: "Valkyra", score: 0 }],
    }
    let events: ResultEvent[] = [
        { id: "review", name: "Reviewed", map: null, result },
        {
            id: "old",
            name: "Historical",
            map: null,
            result: { ...result, reviewedAt: new Date(0).toISOString() },
        },
        {
            id: "pending",
            name: "Unreviewed",
            map: null,
            result: { ...result, status: "provisional" },
        },
    ]
    const stored = new Map<string, { target: string; version: number }>([
        ["panel:other:result:review", { target: "other", version: 1 }],
    ])
    let creates = 0
    const ports = {
        bindings: async () => [...stored.keys()],
        page: async (cursor: string | null) =>
            cursor
                ? { cursor: null, events: events.slice(1) }
                : { cursor: "next", events: events.slice(0, 1) },
        publish: async (
            key: string,
            target: string | null,
            event: ResultEvent | null
        ) => {
            if (!target) {
                stored.delete(key)
                return
            }
            if (!stored.has(key)) creates++
            stored.set(key, { target, version: event!.result!.version })
        },
    }
    await synchronizeResults(panel, ports)
    assert.equal(creates, 1)
    events[0].result = { ...result, status: "corrected", version: 2 }
    await synchronizeResults(panel, ports)
    assert.equal(creates, 1)
    assert.equal(stored.get("panel:p:result:review")?.version, 2)
    events[0].result = { ...result, status: "withdrawn", version: 3 }
    await synchronizeResults(panel, ports)
    assert.deepEqual([...stored.keys()], ["panel:other:result:review"])
    events[0].result = result
    await synchronizeResults(panel, ports)
    await synchronizeResults({ ...panel, enabled: false }, ports)
    assert.equal(stored.has("panel:p:result:review"), false)
    await synchronizeResults(panel, ports)
    await synchronizeResults(panel, { ...ports, page: async () => null })
    assert.equal(stored.has("panel:p:result:review"), true)
    events = []
    await synchronizeResults(panel, ports)
    assert.equal(stored.has("panel:p:result:review"), false)
})
