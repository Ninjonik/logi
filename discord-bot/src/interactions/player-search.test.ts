import assert from "node:assert/strict"
import test from "node:test"

import {
    detectPlatformFromStatsId,
    extractPlayerSearchResults,
} from "./player-search"

test("extractPlayerSearchResults reads players from stats search payload", () => {
    const payload = {
        result: {
            total: 1,
            players: [
                {
                    player_id: "ssss",
                    names: [{ name: "ssss" }],
                    soldier: {
                        name: "ssss",
                        platform: null,
                    },
                },
            ],
        },
    }

    assert.deepEqual(extractPlayerSearchResults(payload), [
        { playerId: "ssss", playerName: "ssss" },
    ])
})

test("extractPlayerSearchResults falls back to names when soldier name is missing", () => {
    const payload = {
        result: {
            players: [
                {
                    player_id: "76561198000000000",
                    names: [{ name: "Alpha" }],
                    soldier: {
                        name: null,
                    },
                },
            ],
        },
    }

    assert.deepEqual(extractPlayerSearchResults(payload), [
        { playerId: "76561198000000000", playerName: "Alpha" },
    ])
})

test("detectPlatformFromStatsId detects known id formats", () => {
    assert.equal(detectPlatformFromStatsId("76561198000000000"), "steam")
    assert.equal(
        detectPlatformFromStatsId("123e4567-e89b-12d3-a456-426614174000"),
        "epic"
    )
    assert.equal(detectPlatformFromStatsId("plain-name"), "other")
})

test("extractPlayerSearchResults keeps when CRCON last saw the player (L4-51)", () => {
    const payload = {
        result: {
            players: [
                {
                    player_id: "76561198000000017",
                    names: [{ name: "Hráč 17" }],
                    last_seen_timestamp_ms: 1791100800000,
                },
                {
                    player_id: "8f3c2e1d0a9b8c7d6e5f4a3b2c1d0e9f",
                    names: [{ name: "Hrac17_CZ" }],
                    last_seen: "2026-09-12T18:00:00Z",
                },
                {
                    player_id: "76561198000000018",
                    names: [{ name: "Bez data" }],
                    last_seen_timestamp_ms: "zítra",
                },
            ],
        },
    }

    assert.deepEqual(extractPlayerSearchResults(payload), [
        {
            playerId: "76561198000000017",
            playerName: "Hráč 17",
            lastSeenAt: 1791100800000,
        },
        {
            playerId: "8f3c2e1d0a9b8c7d6e5f4a3b2c1d0e9f",
            playerName: "Hrac17_CZ",
            lastSeenAt: Date.parse("2026-09-12T18:00:00Z"),
        },
        { playerId: "76561198000000018", playerName: "Bez data" },
    ])
})
