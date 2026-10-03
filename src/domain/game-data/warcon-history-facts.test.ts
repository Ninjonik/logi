import { classifyWarconOutcome } from "./warcon-history-facts"
import assert from "node:assert/strict"
import test from "node:test"

test("Warcon's no-winner positive-score result is a draw, even without a score tie", () => {
    assert.equal(
        classifyWarconOutcome(null, [
            { name: "Alpha", score: 2 },
            { name: "Bravo", score: 1 },
        ]),
        "draw"
    )
    assert.equal(classifyWarconOutcome(null, []), "no_result")
    assert.equal(
        classifyWarconOutcome(null, [{ name: "Alpha", score: 0 }]),
        "no_result"
    )
    assert.equal(classifyWarconOutcome("Bravo", []), "decided")
})
