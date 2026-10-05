import assert from "node:assert/strict"
import test from "node:test"

import {
    reminderAudience,
    reminderStatusesFor,
    splitLocalDateTime,
    suggestedEventName,
    teamChipCode,
} from "./new-match-flow"

test("the suggested name follows the teams and the template", () => {
    assert.equal(
        suggestedEventName({
            kind: "match",
            ownCode: "VLK",
            opponentCode: "ROG",
            templateName: "Přátelák",
        }),
        "VLK vs ROG · Přátelák"
    )
    assert.equal(
        suggestedEventName({
            kind: "match",
            opponentCode: "ROG",
            templateName: "Liga",
        }),
        "ROG · Liga"
    )
    assert.equal(
        suggestedEventName({ kind: "match", templateName: " Liga " }),
        "Liga"
    )
    assert.equal(
        suggestedEventName({
            kind: "training",
            ownCode: "VLK",
            opponentCode: "ROG",
            templateName: "Trénink",
        }),
        "Trénink"
    )
})

test("team chips use the short code or initials", () => {
    assert.equal(teamChipCode("Rogue Squadron", "rog"), "ROG")
    assert.equal(teamChipCode("Rogue Squadron"), "RS")
    assert.equal(teamChipCode("Valkyrie"), "VAL")
})

test("reminder audiences round-trip", () => {
    for (const audience of ["off", "member", "memberRecruit", "all"] as const)
        assert.equal(reminderAudience(reminderStatusesFor(audience)), audience)
    assert.equal(reminderAudience(["recruit"]), "memberRecruit")
})

test("datetime-local values split into date and time", () => {
    assert.deepEqual(splitLocalDateTime("2026-10-11T20:00"), {
        date: "2026-10-11",
        time: "20:00",
    })
    assert.deepEqual(splitLocalDateTime(""), { date: "", time: "" })
})
