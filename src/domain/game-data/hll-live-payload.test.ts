import {
    hllLiveComparable,
    hllLiveFreshness,
    hllLiveWithFreshness,
    readHllLivePayload,
} from "./hll-live-payload"
import { hllLiveFixture } from "../../infrastructure/testing/hll-live"
import { hllLiveSchema } from "./hll-live"
import assert from "node:assert/strict"
import test from "node:test"

test("the HLL payload guard reads what the schema produced and refuses the rest", () => {
    const data = hllLiveSchema.parse(hllLiveFixture())
    assert.deepEqual(readHllLivePayload(JSON.stringify(data)), data)
    const noStatus = { ...data, status: null, statusFreshness: "unavailable" }
    assert.deepEqual(readHllLivePayload(JSON.stringify(noStatus)), noStatus)
    for (const bad of [
        "not json",
        "null",
        JSON.stringify({ ...data, fetchedAt: 5 }),
        JSON.stringify({ ...data, statusFreshness: "old" }),
        JSON.stringify({ ...data, status: { serverName: 1 } }),
        JSON.stringify({ ...data, players: [{ name: 1 }] }),
        JSON.stringify({ ...data, warnings: "none" }),
    ])
        assert.equal(readHllLivePayload(bad), null, bad)
})

test("the times live beside the payload: compared without them, served with the row's", () => {
    const data = hllLiveFixture()
    const later = "2026-10-04T00:00:30.000Z"
    const same = {
        ...data,
        fetchedAt: later,
        statusAt: later,
        playersAt: later,
    }
    assert.equal(hllLiveComparable(same), hllLiveComparable(data))
    assert.notEqual(
        hllLiveComparable({ ...same, playersFreshness: "stale" }),
        hllLiveComparable(data)
    )
    assert.notEqual(
        hllLiveComparable({
            ...same,
            status: { ...same.status!, playerCount: 3 },
        }),
        hllLiveComparable(data)
    )
    assert.deepEqual(hllLiveFreshness(same), {
        fetchedAt: later,
        statusAt: later,
        playersAt: later,
    })
    assert.deepEqual(hllLiveWithFreshness(data, hllLiveFreshness(same)), same)
    // A row from before the fields keeps the payload's own times.
    assert.deepEqual(hllLiveWithFreshness(data, {}), data)
    assert.deepEqual(
        hllLiveWithFreshness(data, { fetchedAt: later, playersAt: null }),
        { ...data, fetchedAt: later, playersAt: null }
    )
})
