import { historyRecord } from "../../infrastructure/testing/game-history"
import { aggregateHistory } from "./history-report"
import assert from "node:assert/strict"
import test from "node:test"

test("duplicate faction metadata cannot inflate retained wins or appearances", () => {
    const record = historyRecord()
    const winningFaction = record.session.warcon!.factions.find(
        (faction) => faction.name === record.session.warcon!.winner
    )!
    record.session.warcon!.factions.push({ ...winningFaction })
    assert.throws(() => aggregateHistory([record]), /Duplicate Warcon faction/)
})

test("replay and correction replace contributions; no-result and unknown player results are not losses", () => {
    const first = historyRecord(),
        correction = structuredClone(first),
        abandoned = historyRecord("game-2")
    correction.revision = "2"
    correction.session.warcon!.winner = "Manticore"
    correction.session.players[0].result = "loss"
    abandoned.session.warcon!.winner = null
    abandoned.session.warcon!.outcome = "no_result"
    abandoned.session.participants = []
    abandoned.session.players[0].result = null
    abandoned.session.players[0].name = "Latest name"
    abandoned.session.endedAt = "2026-10-03T12:00:00.000Z"
    const report = aggregateHistory([correction, first, abandoned, correction])
    assert.equal(report.games, 2)
    assert.equal(report.outcomes.decided, 1)
    assert.equal(report.outcomes.no_result, 1)
    assert.equal(report.factions.find((f) => f.name === "Manticore")!.wins, 1)
    assert.equal(report.factions.find((f) => f.name === "Valkyra")!.wins, 0)
    const player = report.players[0]
    assert.equal(player.name, "Latest name")
    assert.deepEqual(
        [player.wins, player.losses, player.draws, player.unknownResults],
        [0, 1, 0, 1]
    )
    assert.equal(player.winRate, 0)
    assert.equal(player.metrics.kills.value, 24)
    assert.equal(player.metrics.cashDelta.value, -40)
    assert.deepEqual(player.metrics.headshots, { value: null, knownGames: 0 })
    assert.equal(player.kd, null)
})

test("eligibility is playtime based, identity is platform ID, incomplete metrics never become full ratios", () => {
    const first = historyRecord(),
        second = historyRecord("game-2")
    first.session.players[0].metrics.seconds = 60
    second.session.players[0].platformId = "another-player"
    second.session.players[0].metrics.deaths = null
    const report = aggregateHistory([first, second])
    assert.equal(report.players.length, 2)
    assert.equal(
        report.players.find((p) => p.platformId === "synthetic-player")!
            .eligible,
        false
    )
    assert.equal(
        report.players.find((p) => p.platformId === "another-player")!.eligible,
        true
    )
    assert.equal(
        report.players.find((p) => p.platformId === "another-player")!.kd,
        null
    )
    assert.equal(report.eligiblePlayers, 1)
})
