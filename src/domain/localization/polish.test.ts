import { polishNoun, polishPlayers } from "./polish"
import assert from "node:assert/strict"
import test from "node:test"

test("Polish noun forms handle teens, larger numbers and fractions", () => {
    for (const [count, expected] of [
        [0, "meczów"],
        [1, "mecz"],
        [2, "mecze"],
        [4, "mecze"],
        [5, "meczów"],
        [12, "meczów"],
        [14, "meczów"],
        [21, "meczów"],
        [22, "mecze"],
        [24, "mecze"],
        [25, "meczów"],
        [101, "meczów"],
        [112, "meczów"],
        [122, "mecze"],
        [1.5, "meczu"],
    ] as const) {
        assert.equal(
            polishNoun(count, "mecz", "mecze", "meczów", "meczu"),
            expected
        )
    }
    assert.equal(polishPlayers("1"), "gracz")
    assert.equal(polishPlayers("1 000"), "graczy")
    assert.equal(polishPlayers("1,000"), "graczy")
})
