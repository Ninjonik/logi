import { wardogsPlayerStats } from "../../../src/domain/player-stats/player-stats"
import { historyRecord } from "../../../src/infrastructure/testing/game-history"
import { renderStats } from "./stats-render"
import assert from "node:assert/strict"
import test from "node:test"
test("stats card escapes player text, preserves zero and unknown KD, and exposes no raw platform ID", () => {
    const row = historyRecord()
    row.session.players[0].platformId = "76561198199051397"
    row.session.players[0].name = "@everyone **fake**"
    const card = renderStats({
        game: "wardogs",
        period: "all",
        locale: "cs",
        result: {
            kind: "wardogs",
            steamId: "76561198199051397",
            name: null,
            stats: wardogsPlayerStats([row], "76561198199051397"),
            fetchedAt: row.collectedAt,
        },
    })
    const json = JSON.stringify(card),
        embed = card.embeds[0].toJSON()
    assert.match(json, /12/)
    // 12 kills without a death is a ratio against one death, not an unknown value.
    assert.match(json, /K\/D \*\*12/)
    assert.ok(!json.includes("76561198199051397"))
    assert.deepEqual(card.allowedMentions, { parse: [] })
    assert.ok((embed.fields ?? []).every((f) => f.value.length <= 1024))
})
test("a blocked HLL provider gets an honest unavailable card instead of a missing-account prompt", () => {
    const card = renderStats({
        game: "hll",
        period: "30d",
        locale: "cs",
        result: {
            kind: "hll",
            steamId: "76561198199051397",
            name: "Soldier",
            read: {
                status: "unavailable",
                profile: null,
                fetchedAt: null,
                reason: "blocked",
            },
        },
    })
    assert.match(card.embeds[0].toJSON().description!, /blokuje automatické/)
    assert.ok(!card.embeds[0].toJSON().fields?.length)
})
