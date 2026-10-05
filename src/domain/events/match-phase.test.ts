import assert from "node:assert/strict"
import test from "node:test"

import { deriveMatchPhases, type MatchPhaseInput } from "./match-phase"

const base: MatchPhaseInput = {
    createdAt: "2026-10-04T10:00:00.000Z",
    registrationStart: "2026-10-05T10:00:00.000Z",
    registrationEnd: "2026-10-10T17:30:00.000Z",
    meetingStart: "2026-10-11T17:30:00.000Z",
    gameEnd: "2026-10-11T19:30:00.000Z",
    status: "registration",
    signedUpCount: 23,
    roster: null,
    presentCount: 0,
    result: "none",
}

function states(input: MatchPhaseInput, now: string) {
    return deriveMatchPhases(input, new Date(now)).map((step) => step.state)
}

test("a match before its sign-ups open is a draft", () => {
    const steps = deriveMatchPhases(base, new Date("2026-10-04T12:00:00Z"))
    assert.deepEqual(
        steps.map((step) => step.state),
        ["current", "upcoming", "upcoming", "upcoming", "upcoming"]
    )
    assert.deepEqual(steps[0]?.detail, {
        kind: "opensAt",
        at: base.registrationStart,
    })
})

test("open sign-ups show when they close", () => {
    const steps = deriveMatchPhases(base, new Date("2026-10-06T12:00:00Z"))
    assert.deepEqual(
        steps.map((step) => step.state),
        ["done", "current", "upcoming", "upcoming", "upcoming"]
    )
    assert.deepEqual(steps[0]?.detail, {
        kind: "createdAt",
        at: base.createdAt,
    })
    assert.deepEqual(steps[1]?.detail, {
        kind: "closesAt",
        at: base.registrationEnd,
    })
    assert.deepEqual(steps[2]?.detail, { kind: "rosterMissing" })
})

test("closed sign-ups make the roster the current step until it is published", () => {
    const draft = { ...base, roster: { published: false, assignedCount: 18 } }
    const steps = deriveMatchPhases(draft, new Date("2026-10-10T20:00:00Z"))
    assert.deepEqual(
        steps.map((step) => step.state),
        ["done", "done", "current", "upcoming", "upcoming"]
    )
    assert.deepEqual(steps[1]?.detail, { kind: "signedUp", count: 23 })
    assert.deepEqual(steps[2]?.detail, { kind: "rosterDraft" })

    const published = {
        ...base,
        roster: { published: true, assignedCount: 21 },
    }
    const next = deriveMatchPhases(published, new Date("2026-10-10T20:00:00Z"))
    assert.equal(next[3]?.state, "current")
    assert.deepEqual(next[2]?.detail, { kind: "rosterPublished", count: 21 })
})

test("the meeting starts the match even without a published roster", () => {
    assert.deepEqual(states(base, "2026-10-11T18:00:00Z"), [
        "done",
        "done",
        "done",
        "current",
        "upcoming",
    ])
})

test("a closed match waits for its result, and a confirmed result finishes it", () => {
    const concluded = {
        ...base,
        status: "concluded" as const,
        presentCount: 20,
        result: "provisional" as const,
    }
    const steps = deriveMatchPhases(concluded, new Date("2026-10-11T20:00:00Z"))
    assert.deepEqual(
        steps.map((step) => step.state),
        ["done", "done", "done", "done", "current"]
    )
    assert.deepEqual(steps[3]?.detail, { kind: "present", count: 20 })
    assert.deepEqual(steps[4]?.detail, {
        kind: "result",
        state: "provisional",
    })

    assert.deepEqual(
        states({ ...concluded, result: "confirmed" }, "2026-10-12T00:00:00Z"),
        ["done", "done", "done", "done", "done"]
    )
})

test("a match past its end reads as closed before the bot records it", () => {
    assert.deepEqual(states(base, "2026-10-11T20:00:00Z"), [
        "done",
        "done",
        "done",
        "done",
        "current",
    ])
})

test("legacy matches without a registration start are open right away", () => {
    const legacy = { ...base, registrationStart: undefined }
    assert.deepEqual(states(legacy, "2026-10-04T12:00:00Z"), [
        "done",
        "current",
        "upcoming",
        "upcoming",
        "upcoming",
    ])
})
