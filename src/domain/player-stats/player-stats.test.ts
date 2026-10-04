import {
    linkedSteamIds,
    parseSteamId,
    wardogsPlayerStats,
} from "./player-stats"
import { historyRecord } from "../../infrastructure/testing/game-history"
import assert from "node:assert/strict"
import test from "node:test"

const steam = "76561198199051397"
test("Steam linking accepts an exact ID or profile URL without guessing nicknames", () => {
    assert.equal(parseSteamId(steam), steam)
    assert.equal(parseSteamId(`steam:${steam}`), steam)
    assert.equal(
        parseSteamId(`https://steamcommunity.com/profiles/${steam}/`),
        steam
    )
    for (const invalid of [
        "Ka$heK",
        "123",
        `xbox:${steam}`,
        `https://steamcommunity.com.evil/profiles/${steam}`,
        `https://evil@steamcommunity.com/profiles/${steam}`,
        "https://steamcommunity.com/id/kashek/",
        "76561197960265728",
    ])
        assert.equal(parseSteamId(invalid), null)
    assert.deepEqual(linkedSteamIds([steam, `steam:${steam}`, "xbox:abc"]), [
        steam,
    ])
})

test("Wardogs player report keeps identity across renames and uses only that player's facts", () => {
    const first = historyRecord("first"),
        second = historyRecord("second")
    first.session.players = [
        {
            platform: "steam",
            platformId: steam,
            name: "Before",
            faction: "Valkyra",
            result: "win",
            metrics: { seconds: 3600, kills: 10, deaths: 0, cashDelta: -20 },
        },
    ]
    second.session.players = [
        {
            platform: "steam",
            platformId: steam,
            name: "After",
            faction: "Manticore",
            result: "loss",
            metrics: { seconds: 1800, kills: 4, deaths: 7, cashDelta: 50 },
        },
        {
            platform: "steam",
            platformId: "76561198000000001",
            name: "Before",
            faction: "Valkyra",
            result: "win",
            metrics: { kills: 999 },
        },
    ]
    second.session.endedAt = "2026-10-03T12:00:00.000Z"
    const report = wardogsPlayerStats([first, second], steam)
    assert.equal(report?.player.name, "After")
    assert.equal(report?.player.matches, 2)
    assert.equal(report?.player.kd, 2)
    assert.equal(report?.player.winRate, 0.5)
    assert.equal(report?.player.metrics.cashDelta.value, 30)
    assert.deepEqual(
        report?.factions.map((f) => [f.name, f.matches, f.wins]),
        [
            ["Manticore", 1, 0],
            ["Valkyra", 1, 1],
        ]
    )
    assert.equal(report?.recent[0].name, "After")
    assert.equal(wardogsPlayerStats([first], "76561198000000002"), null)
})

test("unknown deaths never become zero or a fabricated K/D", () => {
    const game = historyRecord("partial")
    game.session.players = [
        {
            platform: "steam",
            platformId: steam,
            name: null,
            faction: null,
            result: null,
            metrics: { kills: 3 },
        },
    ]
    const player = wardogsPlayerStats([game], steam)?.player
    assert.equal(player?.kd, null)
    assert.equal(player?.winRate, null)
    assert.equal(player?.metrics.deaths.value, null)
})
