import assert from "node:assert/strict"
import test from "node:test"

import { compactStoredMatchPlayer } from "./server-match-results"

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
