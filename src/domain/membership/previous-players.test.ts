import assert from "node:assert/strict"
import test from "node:test"

import { findPreviousPlayers, normalizePlayerName } from "./previous-players"

const games = [
    {
        endedAt: "2026-09-12T20:00:00.000Z",
        serverName: "Vlci #2",
        players: [
            {
                platform: "unknown" as const,
                platformId: "0123456789abcdef0123456789abcdef",
                name: "Hrac17_CZ",
            },
            {
                platform: "steam" as const,
                platformId: "76561198000000017",
                name: "Hráč 17",
            },
        ],
    },
    {
        endedAt: "2026-10-03T20:00:00.000Z",
        serverName: "Vlci #1",
        players: [
            {
                platform: "steam" as const,
                platformId: "76561198000000017",
                name: "Hráč 17",
            },
            {
                platform: "steam" as const,
                platformId: "76561198000000099",
                name: "Someone else",
            },
        ],
    },
]

test("names match without case, diacritics or spaces", () => {
    assert.equal(normalizePlayerName("Hráč 17"), "hrac17")
    assert.equal(normalizePlayerName("Hrac17_CZ"), "hrac17cz")
})

test("candidates: exact match first, last seen on the latest server (L6-29)", () => {
    const found = findPreviousPlayers(games, "Hráč 17")
    assert.deepEqual(
        found.map((player) => [
            player.name,
            player.platform,
            player.lastSeenAt.slice(0, 10),
            player.serverName,
        ]),
        [
            ["Hráč 17", "steam", "2026-10-03", "Vlci #1"],
            ["Hrac17_CZ", "epic", "2026-09-12", "Vlci #2"],
        ]
    )
    assert.equal(found[0]!.key, "steam:76561198000000017")
})

test("short or empty names do not match loosely", () => {
    assert.deepEqual(findPreviousPlayers(games, "  "), [])
    assert.deepEqual(findPreviousPlayers(games, "17"), [])
    assert.equal(findPreviousPlayers(games, "hrac17", 1).length, 1)
})
