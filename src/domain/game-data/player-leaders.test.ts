import { playerLeaders } from "./player-leaders"
import assert from "node:assert/strict"
import test from "node:test"

test("kills and current cash rank independently with deterministic ties and semantic factions", () => {
    const players = [
        { name: "Zulu", faction: "Valkyra", kills: 10, cash: 5 },
        { name: "Alpha", faction: "Manticore", kills: 10, cash: 100 },
        { name: "Bravo", faction: " valkyra ", kills: 0, cash: 300 },
        { name: "Charlie", faction: "Lonestar", kills: 2, cash: 0 },
    ]
    assert.deepEqual(
        playerLeaders(players, "kills").map((p) => p.name),
        ["Alpha", "Zulu", "Charlie"]
    )
    assert.deepEqual(
        playerLeaders(players, "cash", "VALKYRA").map((p) => p.name),
        ["Bravo", "Zulu"]
    )
    assert.deepEqual(playerLeaders(players, "kills", "Alpha"), [])
    assert.equal(players[0].name, "Zulu")
})

test("empty or non-finite observations do not invent leaders", () => {
    assert.deepEqual(playerLeaders([], "cash"), [])
    assert.deepEqual(
        playerLeaders(
            [{ name: "bad", faction: "X", kills: NaN, cash: Infinity }],
            "kills"
        ),
        []
    )
})
