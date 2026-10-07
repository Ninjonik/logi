import {
    readWarconEnvelope,
    warconComparable,
    warconEnvelopeWithFreshness,
    warconFreshnessOf,
} from "./warcon-payload"
import { readWarconQueryPayload, warconCacheMs } from "./warcon-query-payload"
import { warconLive, warconTime } from "../../infrastructure/testing/warcon"
import { warconEnvelopeSchema } from "./warcon-contracts"
import { warconQuerySchema } from "./warcon-query"
import assert from "node:assert/strict"
import test from "node:test"

const envelope = warconEnvelopeSchema.parse({
    connectionId: "gameDataConnections:one",
    gameId: "wardogs",
    provider: "wardogs_warcon",
    fetchedAt: warconTime,
    cacheUntil: "2026-10-02T12:00:10.000Z",
    result: {
        view: "live",
        data: {
            ...warconLive(),
            freshness: "fresh",
            playersFreshness: "fresh",
        },
    },
})

test("the Warcon envelope guard reads what the schema produced and refuses the rest", () => {
    assert.deepEqual(readWarconEnvelope(JSON.stringify(envelope)), envelope)
    const catalog = {
        ...envelope,
        result: {
            view: "catalog",
            data: { maps: [], lightings: [], experiences: [] },
        },
    }
    assert.deepEqual(readWarconEnvelope(JSON.stringify(catalog)), catalog)
    for (const bad of [
        "[]",
        JSON.stringify({ ...envelope, gameId: "hell_let_loose" }),
        JSON.stringify({ ...envelope, result: { view: "other", data: {} } }),
        JSON.stringify({ ...envelope, result: { view: "live" } }),
        JSON.stringify({
            ...envelope,
            result: {
                view: "live",
                data: { ...envelope.result.data, ok: "yes" },
            },
        }),
    ])
        assert.equal(readWarconEnvelope(bad), null, bad)
})

test("the times live beside the envelope: compared without them, served with the row's", () => {
    const later = "2026-10-02T12:00:11.000Z"
    const live = envelope.result.view === "live" ? envelope.result.data : null
    assert.ok(live)
    const same = {
        ...envelope,
        fetchedAt: later,
        cacheUntil: "2026-10-02T12:00:21.000Z",
        result: {
            view: "live" as const,
            data: {
                ...live,
                statusAt: later,
                playersAt: later,
                observedAt: later,
                freshness: "stale" as const,
            },
        },
    }
    assert.equal(warconComparable(same), warconComparable(envelope))
    assert.notEqual(
        warconComparable({
            ...same,
            result: {
                view: "live",
                data: { ...same.result.data, players: [] },
            },
        }),
        warconComparable(envelope)
    )
    assert.deepEqual(warconFreshnessOf(same), {
        fetchedAt: later,
        statusAt: later,
        playersAt: later,
        observedAt: later,
    })
    const row = {
        ...warconFreshnessOf(same),
        cacheUntil: Date.parse(same.cacheUntil),
    }
    assert.deepEqual(warconEnvelopeWithFreshness(envelope, row), {
        ...same,
        result: {
            view: "live",
            data: { ...same.result.data, freshness: "fresh" },
        },
    })
    // A row from before the fields keeps the envelope's own times.
    assert.deepEqual(
        warconEnvelopeWithFreshness(envelope, { cacheUntil: 0 }),
        envelope
    )
    const catalog = {
        ...envelope,
        result: {
            view: "catalog" as const,
            data: { maps: [], lightings: [], experiences: [] },
        },
    }
    assert.deepEqual(warconFreshnessOf(catalog), { fetchedAt: warconTime })
    assert.equal(
        warconEnvelopeWithFreshness(catalog, row).cacheUntil,
        same.cacheUntil
    )
})

test("the normalised query reads back as the schema parsed it", () => {
    for (const input of [
        { view: "live" },
        { view: "matches" },
        { view: "leaderboard", sort: "kd", page: 2 },
        { view: "kills", before: warconTime, beforeTime: 12.5 },
        { view: "alternators", map: "Bakurani" },
    ]) {
        const parsed = warconQuerySchema.parse(input)
        const json = JSON.stringify(parsed)
        assert.deepEqual(readWarconQueryPayload(json), parsed)
        assert.equal(JSON.stringify(readWarconQueryPayload(json)), json)
        assert.equal(
            warconCacheMs(readWarconQueryPayload(json)!),
            warconCacheMs(parsed)
        )
    }
    for (const bad of [
        "x",
        "[]",
        JSON.stringify({ view: "secret" }),
        JSON.stringify({ view: "live", ids: "1" }),
        JSON.stringify({ view: "matches", page: { gt: 1 } }),
    ])
        assert.equal(readWarconQueryPayload(bad), null, bad)
})

test("every Warcon view shares the one-minute cache policy", () => {
    assert.equal(warconCacheMs({ view: "live" }), 60_000)
    assert.equal(warconCacheMs({ view: "kills" }), 60_000)
    assert.equal(warconCacheMs({ view: "catalog" }), 60_000)
})
