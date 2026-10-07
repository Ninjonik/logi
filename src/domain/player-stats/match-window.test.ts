import assert from "node:assert/strict"
import test from "node:test"

import { selectPlayerMatchWindow } from "./match-window"

const history = Array.from({ length: 45 }, (_, index) => ({
    eventId: `event-${index}`,
    kills: index,
}))

test("finds a match beyond the first 30 entries of the history", () => {
    const window = selectPlayerMatchWindow(history, "event-40", 10)
    assert.equal(window?.match.eventId, "event-40")
    assert.deepEqual(
        window?.previous.map((item) => item.eventId),
        ["event-41", "event-42", "event-43", "event-44"]
    )
})

test("returns at most the requested number of older matches", () => {
    const window = selectPlayerMatchWindow(history, "event-0", 10)
    assert.equal(window?.previous.length, 10)
    assert.equal(window?.previous[0]?.eventId, "event-1")
    assert.equal(window?.previous[9]?.eventId, "event-10")
})

test("skips duplicate rows of the same event among the older matches", () => {
    const duplicated = [
        { eventId: "a", kills: 1 },
        { eventId: "a", kills: 2 },
        { eventId: "b", kills: 3 },
    ]
    const window = selectPlayerMatchWindow(duplicated, "a", 10)
    assert.equal(window?.match.kills, 1)
    assert.deepEqual(
        window?.previous.map((item) => item.eventId),
        ["b"]
    )
})

test("returns null for an unknown event and tolerates invalid limits", () => {
    assert.equal(selectPlayerMatchWindow(history, "missing", 10), null)
    assert.deepEqual(
        selectPlayerMatchWindow(history, "event-1", -3)?.previous,
        []
    )
})
