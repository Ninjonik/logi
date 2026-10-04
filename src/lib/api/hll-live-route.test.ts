import { hllLiveFixture } from "../../infrastructure/testing/hll-live"
import { hllLiveRouteResponse } from "./hll-live-route"
import assert from "node:assert/strict"
import test from "node:test"
test("HLL API serves a typed no-store envelope and explicitly reports partial observations", async () => {
    const data = hllLiveFixture()
    data.players = []
    data.playersFreshness = "unavailable"
    data.playersAt = null
    data.warnings = ["players_unavailable"]
    const response = await hllLiveRouteResponse(
        new Request("https://logi.example/api/v1/clan/hll-live/one"),
        async () => ({
            kind: "ready",
            envelope: {
                connectionId: "one",
                gameId: "hell_let_loose",
                provider: "hll_crcon",
                data,
            },
        })
    )
    assert.equal(response.status, 200)
    assert.equal(response.headers.get("cache-control"), "no-store")
    assert.equal(
        (await response.json()).data.data.playersFreshness,
        "unavailable"
    )
})
test("HLL API rejects query parameters, denial and retry without reflecting provider secrets", async () => {
    const request = new Request("https://logi.example/api/v1/clan/hll-live/one")
    assert.equal(
        (
            await hllLiveRouteResponse(
                new Request(request.url + "?url=https://other.example"),
                async () => {
                    throw Error("must not read")
                }
            )
        ).status,
        400
    )
    assert.equal(
        (await hllLiveRouteResponse(request, async () => ({ kind: "denied" })))
            .status,
        403
    )
    const busy = await hllLiveRouteResponse(request, async () => ({
        kind: "busy",
        retryAfterMs: 15_001,
    }))
    assert.equal(busy.status, 429)
    assert.equal(busy.headers.get("retry-after"), "16")
    assert.doesNotMatch(
        await (
            await hllLiveRouteResponse(request, async () => {
                throw Error("provider-secret")
            })
        ).text(),
        /provider-secret/
    )
})
