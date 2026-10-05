import {
    LEAGUE_POINTS_RULE,
    parseScoringRule,
    pointsForPlace,
    samePointsRule,
} from "./scoring"
import assert from "node:assert/strict"
import test from "node:test"

test("the rule published on the captured match page is the board's 3, 2, 1", () => {
    assert.deepEqual(parseScoringRule("1st 3 · 2nd 2 · 3rd 1"), [3, 2, 1])
    assert.deepEqual(LEAGUE_POINTS_RULE, [3, 2, 1])
    assert.deepEqual(
        parseScoringRule("  1st 5 ·2nd 3· 3rd 1 · 4th 0 "),
        [5, 3, 1, 0]
    )
})

test("unrecognised or out-of-order rules award nothing silently", () => {
    for (const text of [
        null,
        "",
        "Winner takes all",
        "2nd 2 · 1st 3",
        "1st 3 · 3rd 1",
        "1st three",
        "1st 3 · 2nd 2 · 3rd 1000",
    ])
        assert.equal(parseScoringRule(text), null, String(text))
})

test("points per place follow the rule and unlisted places earn nothing", () => {
    assert.equal(pointsForPlace([3, 2, 1], 1), 3)
    assert.equal(pointsForPlace([3, 2, 1], 3), 1)
    assert.equal(pointsForPlace([3, 2, 1], 4), 0)
    assert.equal(pointsForPlace([3, 2, 1], 0), 0)
    assert.equal(pointsForPlace([3, 2, 1], 1.5), 0)
    assert.equal(samePointsRule([3, 2, 1], [3, 2, 1]), true)
    assert.equal(samePointsRule([3, 2, 1], [3, 2]), false)
})
