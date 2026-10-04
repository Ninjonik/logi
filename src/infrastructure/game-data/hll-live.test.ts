import {
    ProviderError,
    type ProviderHttp,
} from "../../domain/game-data/contracts"
import { ageHllLive, hllMapArtwork } from "../../domain/game-data/hll-live"
import { readHllLive } from "./hll-live"
import assert from "node:assert/strict"
import test from "node:test"

const now = Date.parse("2026-10-04T00:00:00Z")
const status = (start = now / 1000 - 600, map = "Utah Beach Warfare") => ({
    failed: false,
    result: {
        name: { name: "Synthetic HLL" },
        current_map: {
            start,
            map: { id: "utah_warfare", pretty_name: map, game_mode: "warfare" },
        },
        player_count: 2,
        max_player_count: 100,
        score: { allied: 2, axis: 3 },
        time_remaining: 0,
        config: { private: "never export" },
    },
})
const stats = (timestamp = now / 1000) => ({
    failed: false,
    result: {
        snapshot_timestamp: timestamp,
        refresh_interval_sec: 15,
        stats: [
            {
                player: "Synthetic online",
                player_id: "76561198000000001",
                status: "online",
                team: "allies",
                kills: 0,
                deaths: 2,
                steaminfo: { private: "never export" },
            },
            {
                player: "Synthetic offline",
                player_id: "76561198000000002",
                status: "offline",
                team: "axis",
                kills: 999,
            },
        ],
    },
})
function http(sequence: unknown[]): ProviderHttp {
    let i = 0
    return {
        get: async () => {
            const body = sequence[i++]
            if (body instanceof Error) throw body
            return { body, status: 200, etag: null }
        },
    }
}

test("HLL live filters disconnected players, preserves zero and unknown metrics, strips private data", async () => {
    const result = await readHllLive(
        http([status(), stats(), status()]),
        () => now
    )
    assert.equal(result.players.length, 1)
    assert.equal(result.players[0].kills, 0)
    assert.equal(result.players[0].support, null)
    assert.equal(result.status?.timeRemainingSeconds, 0)
    assert.equal(result.playersFreshness, "fresh")
    assert.equal(JSON.stringify(result).includes("never export"), false)
    assert.equal(ageHllLive(result, now + 61_000).playersFreshness, "stale")
})
test("HLL keeps aggregate status when live statistics fail and honors provider retry", async () => {
    const result = await readHllLive(
        http([status(), new ProviderError("rate_limited", 120_000)]),
        () => now
    )
    assert.equal(result.statusFreshness, "fresh")
    assert.equal(result.playersFreshness, "unavailable")
    assert.equal(result.refreshAfterSeconds, 120)
    assert.deepEqual(result.players, [])
})
test("HLL suppresses players across a round transition, even on the same map", async () => {
    const result = await readHllLive(
        http([status(), stats(), status(now / 1000 - 1)]),
        () => now
    )
    assert.deepEqual(result.players, [])
    assert.ok(result.warnings.includes("round_changed"))
    assert.equal(result.statusFreshness, "fresh")
})
test("HLL rejects old-round, future and invalid player timestamps", async () => {
    for (const time of [now / 1000 - 1000, now / 1000 + 300, -1]) {
        const result = await readHllLive(
            http([status(), stats(time), status()]),
            () => now
        )
        assert.equal(result.players.length, 0)
        assert.notEqual(result.playersFreshness, "fresh")
    }
})
test("HLL status failures retain a clearly stale last observation without live players", async () => {
    const previous = await readHllLive(
        http([status(), stats(), status()]),
        () => now
    )
    const result = await readHllLive(
        http([new ProviderError("network")]),
        () => now + 1000,
        previous
    )
    assert.equal(result.status?.map, "Utah Beach Warfare")
    assert.equal(result.statusAt, previous.statusAt)
    assert.equal(result.statusFreshness, "stale")
    assert.deepEqual(result.players, [])
})
test("HLL artwork uses a fixed catalog for localized layer names", () => {
    assert.equal(
        hllMapArtwork("Sainte-Mère-Église Warfare"),
        "/maps/st-mere-eglise.webp"
    )
    assert.equal(
        hllMapArtwork("St. Marie Du Mont Warfare"),
        "/maps/st-marie-du-mont.webp"
    )
    assert.equal(hllMapArtwork("../../secrets"), "/img/games/hll.jpg")
})
