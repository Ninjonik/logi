import assert from "node:assert/strict"
import test from "node:test"

import { hllLiveFixture } from "@/infrastructure/testing/hll-live"
import { testPanelFetch, type PanelTestPorts } from "./test-fetch"
import { warconLive } from "@/infrastructure/testing/warcon"

const now = Date.parse("2026-10-04T00:00:30.000Z")
const never = async () => {
    throw new Error("not this provider")
}
const snapshot = {
    id: "src",
    gameId: "hell_let_loose" as const,
    provider: "hll_crcon",
    displayName: "Vlci #1",
    status: "online",
    freshness: "fresh" as const,
    observedAt: "2026-10-04T00:00:00.000Z",
    map: "Foy",
    players: 30,
    capacity: 100,
    scores: [],
} as unknown as Parameters<typeof testPanelFetch>[0]["snapshot"]

test("an HLL test fetch returns the live summary for the preview", async () => {
    const live = hllLiveFixture()
    live.status!.queueCount = 2
    const ports: PanelTestPorts = {
        readHll: async () => ({
            kind: "ready",
            envelope: {
                connectionId: "hll-1",
                gameId: "hell_let_loose",
                provider: "hll_crcon",
                data: live,
            },
        }),
        readWarcon: never,
    }
    const result = await testPanelFetch(
        { provider: "hll_crcon", snapshot: null, now },
        ports
    )
    assert.equal(result.status, "ok")
    assert.deepEqual(result.summary, {
        serverName: "PR158 TEST · HLL synthetic",
        map: "Utah Beach",
        players: 2,
        capacity: 100,
        queue: 2,
        timeLeftMinutes: 51,
        score: "3 : 2",
        nextMap: null,
        playersInStats: 2,
    })
    assert.equal(result.facts?.game, "hell_let_loose")
})

test("a busy or denied read keeps the collected snapshot and says why", async () => {
    const busy = await testPanelFetch(
        { provider: "hll_crcon", snapshot, now },
        {
            readHll: async () => ({ kind: "busy", retryAfterMs: 4_000 }),
            readWarcon: never,
        }
    )
    assert.equal(busy.status, "busy")
    assert.equal(busy.retryAfterMs, 4_000)
    assert.equal(busy.summary.players, 30)
    const denied = await testPanelFetch(
        { provider: "hll_crcon", snapshot: null, now },
        { readHll: async () => ({ kind: "denied" }), readWarcon: never }
    )
    assert.equal(denied.status, "denied")
    assert.equal(denied.facts, null)
})

test("a thrown read is a failed network attempt without its internal message", async () => {
    const result = await testPanelFetch(
        { provider: "wardogs_warcon", snapshot: null, now },
        {
            readHll: never,
            readWarcon: async () => {
                throw new Error("connect ECONNREFUSED 10.0.0.5:8010 key=abc")
            },
        }
    )
    assert.equal(result.status, "failed")
    assert.equal(result.errorCategory, "network")
    assert.doesNotMatch(JSON.stringify(result), /ECONNREFUSED|key=abc/)
})

test("Wardogs reads the Warcon live view; rate limits keep their category", async () => {
    const data = {
        ...warconLive(),
        freshness: "fresh" as const,
        playersFreshness: "fresh" as const,
    }
    const ok = await testPanelFetch(
        { provider: "wardogs_warcon", snapshot: null, now },
        {
            readHll: never,
            readWarcon: async () =>
                ({
                    kind: "ready",
                    envelope: {
                        connectionId: "wd-1",
                        gameId: "wardogs",
                        provider: "wardogs_warcon",
                        fetchedAt: "2026-10-02T12:00:00.000Z",
                        cacheUntil: "2026-10-02T12:00:15.000Z",
                        result: { view: "live", data },
                    },
                }) as Awaited<ReturnType<PanelTestPorts["readWarcon"]>>,
        }
    )
    assert.equal(ok.status, "ok")
    assert.equal(ok.summary.score, "0 · 12 · 7")
    const limited = await testPanelFetch(
        { provider: "wardogs_warcon", snapshot: null, now },
        {
            readHll: never,
            readWarcon: async () => ({
                kind: "failed",
                errorCategory: "rate_limited",
                retryAfterMs: 40_000,
            }),
        }
    )
    assert.equal(limited.status, "failed")
    assert.equal(limited.errorCategory, "rate_limited")
})

test("other providers show the collected snapshot", async () => {
    const result = await testPanelFetch(
        { provider: "battlemetrics", snapshot, now },
        { readHll: never, readWarcon: never }
    )
    assert.equal(result.status, "snapshot")
    assert.equal(result.summary.serverName, "Vlci #1")
})
