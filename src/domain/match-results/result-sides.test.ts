import assert from "node:assert/strict"
import test from "node:test"

import {
    arrangeResultSides,
    axisAlliesScore,
    resultFaction,
} from "./result-sides"

const allies = { id: "allies", label: "Allies", score: 2 }
const axis = { id: "axis", label: "Axis", score: 3 }

test("factions are recognised in IDs, labels and Czech or German sides", () => {
    assert.equal(resultFaction("Axis"), "axis")
    assert.equal(resultFaction(" osa "), "axis")
    assert.equal(resultFaction("Spojenci"), "allies")
    assert.equal(resultFaction("Alliierte"), "allies")
    assert.equal(resultFaction("Manticore"), "manticore")
    assert.equal(resultFaction("VLK"), null)
    assert.equal(resultFaction(undefined), null)
})

test("the clan's side comes first with the outcome from its point of view", () => {
    assert.deepEqual(arrangeResultSides([allies, axis], "Axis"), {
        ordered: [axis, allies],
        oursIndex: 0,
        outcome: "win",
    })
    assert.deepEqual(arrangeResultSides([allies, axis], "Allies"), {
        ordered: [allies, axis],
        oursIndex: 0,
        outcome: "loss",
    })
    assert.equal(
        arrangeResultSides([allies, { ...axis, score: 2 }], "Spojenci").outcome,
        "draw"
    )
})

test("a reviewed result gives the Axis/Allies score of an import", () => {
    assert.deepEqual(axisAlliesScore([allies, axis]), { sideA: 3, sideB: 2 })
    assert.equal(axisAlliesScore([allies, { ...axis, score: null }]), null)
    assert.equal(
        axisAlliesScore([
            { id: "a", label: "VLK", score: 3 },
            { id: "b", label: "DEF", score: 2 },
        ]),
        null
    )
})

test("an unknown side or score gives no outcome", () => {
    assert.deepEqual(arrangeResultSides([allies, axis], undefined), {
        ordered: [allies, axis],
        oursIndex: null,
        outcome: null,
    })
    assert.equal(
        arrangeResultSides([allies, { ...axis, score: null }], "Allies")
            .outcome,
        null
    )
})
