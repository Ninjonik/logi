import assert from "node:assert/strict"
import test from "node:test"

import {
    compactStoredMatchPlayer,
    sanitizeScoreboardResult,
} from "./server-match-results"

test("drops unused volatile player fields before match storage", () => {
    const player = compactStoredMatchPlayer({
        player: "Ryhar67",
        death_by: { "Enemy Player": 3 },
        steaminfo: {
            bans: { NumberOfVACBans: 0 },
            profile: { profileurl: "https://steamcommunity.com/id/example/" },
        },
        units: [{ ts: 10, team: 1, squad: 2, role: 3 }],
    })

    assert.deepEqual(player, { player: "Ryhar67", death_by: {} })
})

test("keeps only the raw-match fields accepted by Convex", () => {
    const raw = {
        id: 1,
        creation_time: "2026-09-27T18:00:00.000Z",
        start: "2026-09-27T18:00:00.000Z",
        end: "2026-09-27T19:00:00.000Z",
        server_number: 6,
        map_name: "Foy",
        result: { axis: 4, allied: 1, provider_extra: true },
        game_layout: { requested: [], set: [], provider_extra: true },
        map: {
            id: "foy_warfare",
            pretty_name: "Foy Warfare",
            game_mode: "warfare",
            attackers: null,
            environment: "day",
            image_name: "foy",
            provider_extra: true,
            map: {
                id: "foy",
                name: "Foy",
                tag: "foy",
                pretty_name: "Foy",
                shortname: "FOY",
                orientation: "north",
                allies: {
                    name: "Allies",
                    team: "allies",
                    provider_extra: true,
                },
                axis: { name: "Axis", team: "axis", provider_extra: true },
            },
        },
        player_stats: [
            {
                id: 1,
                player_id: "76561198039787157",
                player: "VLK Simply",
                map_id: 1,
                kill_death_ratio: 1,
                kills: 1,
                kills_streak: 1,
                deaths: 1,
                deaths_without_kill_streak: 1,
                teamkills: 0,
                teamkills_streak: 0,
                deaths_by_tk: 0,
                deaths_by_tk_streak: 0,
                nb_vote_started: 0,
                nb_voted_yes: 0,
                nb_voted_no: 0,
                time_seconds: 60,
                kills_per_minute: 1,
                deaths_per_minute: 1,
                longest_life_secs: 60,
                shortest_life_secs: 1,
                combat: 1,
                offense: 1,
                defense: 1,
                support: 1,
                most_killed: {},
                death_by: {},
                weapons: {},
                death_by_weapons: {},
                team: { side: "allies" },
                level: 1,
                provider_extra: true,
            },
        ],
        provider_extra: true,
    }

    const sanitized = sanitizeScoreboardResult(raw as never)

    assert.equal("provider_extra" in sanitized, false)
    assert.equal("provider_extra" in sanitized.result, false)
    assert.equal("provider_extra" in sanitized.map, false)
    assert.equal("provider_extra" in sanitized.player_stats[0], false)
})
