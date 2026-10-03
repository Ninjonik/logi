import { readPlayerStats, type PlayerStatsPorts } from "./read-player-stats"
import { historyRecord } from "../../infrastructure/testing/game-history"
import assert from "node:assert/strict"
import test from "node:test"

const id = "76561198199051397"
const request = {
    guildId: "guild",
    requesterId: "self",
    targetId: "self",
    game: "hll" as const,
    period: "30d" as const,
}
function ports(): PlayerStatsPorts {
    return {
        authorize: async () => true,
        account: async () => ({ steamIds: [], name: "Fixture" }),
        history: async () => ({ records: [], lastCollectedAt: null }),
        hll: async () => ({
            status: "unavailable",
            profile: null,
            fetchedAt: null,
            reason: "blocked",
        }),
    }
}
test("missing Steam account offers linking before any source read; no records do not unlink it", async () => {
    const p = ports()
    let calls = 0
    p.hll = async () => {
        calls++
        return { status: "empty", profile: null, fetchedAt: null, reason: null }
    }
    assert.equal((await readPlayerStats(request, p)).kind, "missing_link")
    assert.equal(calls, 0)
    p.account = async () => ({ steamIds: [id], name: "Fixture" })
    assert.equal((await readPlayerStats(request, p)).kind, "hll")
    assert.equal(calls, 1)
})
test("HLL forbids arbitrary Steam lookup and multiple legacy IDs need an explicit correction", async () => {
    const p = ports()
    p.account = async () => ({
        steamIds: [id, "76561198000000001"],
        name: null,
    })
    assert.equal((await readPlayerStats(request, p)).kind, "ambiguous_link")
    await assert.rejects(
        readPlayerStats({ ...request, playerId: id }, p),
        /linked_only/
    )
})
test("a Steam binding change or lost membership during provider wait withholds the reply", async () => {
    const p = ports()
    let current = id
    p.account = async () => ({ steamIds: [current], name: null })
    p.hll = async () => {
        current = "76561198000000001"
        return { status: "empty", profile: null, fetchedAt: null, reason: null }
    }
    await assert.rejects(readPlayerStats(request, p), /link_changed/)
    p.authorize = async () => false
    await assert.rejects(readPlayerStats(request, p), /forbidden/)
})
test("Wardogs nickname selection uses explicit Steam identity and unfinished history fails instead of partial stats", async () => {
    const p = ports(),
        row = historyRecord()
    row.session.players[0].platformId = id
    p.history = async () => ({
        records: [row],
        lastCollectedAt: row.collectedAt,
    })
    const result = await readPlayerStats(
        { ...request, game: "wardogs", playerId: id },
        p
    )
    assert.equal(result.kind, "wardogs")
    if (result.kind === "wardogs")
        assert.equal(result.stats?.player.metrics.kills.value, 12)
    p.history = async () => {
        throw new Error("incomplete")
    }
    await assert.rejects(
        readPlayerStats({ ...request, game: "wardogs", playerId: id }, p),
        /incomplete/
    )
})
