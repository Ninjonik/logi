import assert from "node:assert/strict"
import test from "node:test"

import {
    findEventsLinkingStratmap,
    withoutStratmap,
} from "./stratmap-references"

const events = [
    { id: "e1", name: "Match A", stratmapIds: ["s1", "s2"] },
    { id: "e2", name: "Match B", stratmapIds: ["s2"] },
    { id: "e3", name: "Training" },
    { id: "e4", name: "Match C", stratmapIds: [] },
]

test("finds only the events that link the stratmap", () => {
    assert.deepEqual(
        findEventsLinkingStratmap(events, "s2").map((event) => event.id),
        ["e1", "e2"]
    )
    assert.deepEqual(findEventsLinkingStratmap(events, "s9"), [])
})

test("removes the stratmap and keeps other links in order", () => {
    assert.deepEqual(withoutStratmap(["s1", "s2", "s3"], "s2"), ["s1", "s3"])
    assert.deepEqual(withoutStratmap(["s2", "s2"], "s2"), [])
    assert.deepEqual(withoutStratmap(undefined, "s2"), [])
})
