import { parseWarconQuery } from "../../domain/game-data/warcon-query"
import { warconRouteResponse } from "./warcon-route"
import assert from "node:assert/strict"
import { test } from "node:test"
test("Warcon queries require a single game, a known view and bounded view-specific parameters", () => {
    for (const query of [
        "view=live",
        "game=hell_let_loose&view=live",
        "game=wardogs&view=live&game=wardogs",
        "game=wardogs&view=live&url=https://bad",
        "game=wardogs&view=leaderboard&scope=org",
        "game=wardogs&view=kills&beforeTime=10",
        "game=wardogs&view=matches&page=0",
        "game=wardogs&view=match&matchId=../../other",
    ])
        assert.equal(parseWarconQuery(new URLSearchParams(query)), null, query)
    assert.deepEqual(
        parseWarconQuery(
            new URLSearchParams("game=wardogs&view=matches&page=2")
        ),
        { view: "matches", page: 2 }
    )
})
test("invalid HTTP query cannot trigger a backend read", async () => {
    let called = false
    const response = await warconRouteResponse(
        new Request("https://logi.test?game=wardogs&view=live&scope=org"),
        async () => {
            called = true
            return { kind: "denied" }
        }
    )
    assert.equal(response.status, 400)
    assert.equal(called, false)
    assert.equal(response.headers.get("cache-control"), "no-store")
})
test("scope denial, upstream failure and shared backoff are explicit non-cacheable responses", async () => {
    const request = new Request("https://logi.test?game=wardogs&view=live")
    const denied = await warconRouteResponse(request, async () => ({
        kind: "denied",
    }))
    assert.equal(denied.status, 403)
    const busy = await warconRouteResponse(request, async () => ({
        kind: "busy",
        retryAfterMs: 1501,
    }))
    assert.equal(busy.status, 429)
    assert.equal(busy.headers.get("retry-after"), "2")
    const failed = await warconRouteResponse(request, async () => {
        throw new Error("secret upstream error")
    })
    assert.equal(failed.status, 503)
    assert.equal((await failed.text()).includes("secret"), false)
})
