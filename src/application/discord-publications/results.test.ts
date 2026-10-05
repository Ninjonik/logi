import {
    RESULTS_BACKFILL,
    synchronizeResults,
    wantedResultIds,
    type ResultEvent,
} from "./results"
import assert from "node:assert/strict"
import test from "node:test"

const result = (reviewedAt: number, status = "confirmed", version = 1) => ({
    status,
    version,
    reviewedAt: new Date(reviewedAt).toISOString(),
    participants: [{ label: "Valkyra", score: 0 }],
})

function ports(events: () => ResultEvent[], stored: Map<string, unknown>) {
    const order: string[] = []
    let creates = 0
    return {
        order,
        creates: () => creates,
        value: {
            bindings: async () => [...stored.keys()],
            page: async (cursor: string | null) =>
                cursor
                    ? { cursor: null, events: events().slice(1) }
                    : { cursor: "next", events: events().slice(0, 1) },
            publish: async (
                key: string,
                target: string | null,
                event: ResultEvent | null
            ) => {
                if (!target) {
                    stored.delete(key)
                    return
                }
                if (!stored.has(key)) {
                    creates++
                    order.push(key)
                }
                stored.set(key, { target, version: event!.result!.version })
            },
        },
    }
}

test("results publish once, correct the same card, and withdraw without touching another feature", async () => {
    const panel = {
        id: "p",
        enabled: true,
        createdAt: 1000,
        channelId: "destination",
        backfill: 0,
    }
    let events: ResultEvent[] = [
        { id: "review", name: "Reviewed", map: null, result: result(2000) },
        { id: "old", name: "Historical", map: null, result: result(0) },
        {
            id: "pending",
            name: "Unreviewed",
            map: null,
            result: result(2000, "provisional"),
        },
    ]
    const stored = new Map<string, unknown>([
        ["panel:other:result:review", { target: "other", version: 1 }],
    ])
    const fake = ports(() => events, stored)
    await synchronizeResults(panel, fake.value)
    assert.equal(fake.creates(), 1)
    events[0].result = result(2000, "corrected", 2)
    await synchronizeResults(panel, fake.value)
    assert.equal(fake.creates(), 1)
    assert.deepEqual(stored.get("panel:p:result:review"), {
        target: "destination",
        version: 2,
    })
    events[0].result = result(2000, "withdrawn", 3)
    await synchronizeResults(panel, fake.value)
    assert.deepEqual([...stored.keys()], ["panel:other:result:review"])
    events[0].result = result(2000)
    await synchronizeResults(panel, fake.value)
    // An unsent or removed panel withdraws every card it owns.
    await synchronizeResults({ ...panel, enabled: false }, fake.value)
    assert.equal(stored.has("panel:p:result:review"), false)
    await synchronizeResults(panel, fake.value)
    await synchronizeResults(panel, { ...fake.value, page: async () => null })
    assert.equal(stored.has("panel:p:result:review"), true)
    events = []
    await synchronizeResults(panel, fake.value)
    assert.equal(stored.has("panel:p:result:review"), false)
})

test("a new results panel backfills the last five confirmed results, oldest first (P6-B09)", async () => {
    const events: ResultEvent[] = Array.from({ length: 8 }, (_, index) => ({
        id: `e${index}`,
        name: `Match ${index}`,
        map: null,
        // Shuffled review times: e0 → 700, e1 → 100, …
        result: result([700, 100, 400, 800, 200, 600, 300, 500][index]!),
    }))
    events.push({
        id: "draft",
        name: "Provisional",
        map: null,
        result: result(900, "provisional"),
    })
    const stored = new Map<string, unknown>()
    const fake = ports(() => events, stored)
    const panel = { id: "p", enabled: true, createdAt: 1000, channelId: "c" }
    assert.equal(RESULTS_BACKFILL, 5)
    await synchronizeResults(panel, fake.value)
    assert.deepEqual(fake.order, [
        "panel:p:result:e2", // 400
        "panel:p:result:e7", // 500
        "panel:p:result:e5", // 600
        "panel:p:result:e0", // 700
        "panel:p:result:e3", // 800
    ])
    // Later passes keep the same five and add new confirmations after them.
    events.push({ id: "new", name: "New", map: null, result: result(1500) })
    await synchronizeResults(panel, fake.value)
    assert.equal(fake.creates(), 6)
    assert.equal(fake.order.at(-1), "panel:p:result:new")
})

test("wanted results: older ones only up to the backfill, newer always", () => {
    const events: ResultEvent[] = [
        { id: "a", name: "a", map: null, result: result(100) },
        { id: "b", name: "b", map: null, result: result(200) },
        { id: "c", name: "c", map: null, result: result(5000) },
        { id: "x", name: "x", map: null, result: null },
    ]
    assert.deepEqual(
        [...wantedResultIds(events, { createdAt: 1000, backfill: 1 })].sort(),
        ["b", "c"]
    )
    assert.deepEqual(
        [...wantedResultIds(events, { createdAt: 1000, backfill: 0 })],
        ["c"]
    )
})
