import { debriefThreadName, matchesDebriefThreadName } from "./debrief-thread"
import assert from "node:assert/strict"
import test from "node:test"

test("new debrief names use the correct separator and retain the full event suffix", () => {
    assert.equal(
        debriefThreadName("Debrief", "Match", "event-1"),
        "Debrief \u00b7 Match \u00b7 event-1"
    )
    const long = debriefThreadName("Debrief", "Match".repeat(100), "event-1")
    assert.equal(long.length, 100)
    assert.ok(matchesDebriefThreadName(long, "event-1"))
})

test("recovery recognizes correct and historical corrupted suffixes but never another event", () => {
    for (const separator of ["\u00b7", "\u00c2\u00b7"]) {
        const name = `Previous title ${separator} event-1`
        assert.equal(matchesDebriefThreadName(name, "event-1"), true)
        assert.equal(matchesDebriefThreadName(name, "event-10"), false)
        assert.equal(
            matchesDebriefThreadName(
                `Previous title ${separator} event-10`,
                "event-1"
            ),
            false
        )
    }
    assert.equal(
        matchesDebriefThreadName("Some other event-1", "event-1"),
        false
    )
    assert.equal(
        matchesDebriefThreadName("Debrief \u00b7 event-1 extra", "event-1"),
        false
    )
})
