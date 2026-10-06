import assert from "node:assert/strict"
import test from "node:test"

import { seenDay } from "./text"

const now = Date.parse("2026-10-06T10:00:00.000Z")

test("last seen: the weekday only within the last 7 days (L4-51, L6-29)", () => {
    assert.equal(
        seenDay("2026-10-03T19:00:00.000Z", "cs-CZ", "Europe/Prague", now),
        "so 3. 10."
    )
    assert.equal(
        seenDay("2026-09-12T19:00:00.000Z", "cs-CZ", "Europe/Prague", now),
        "12. 9."
    )
    // Exactly a week ago is no longer recent.
    assert.equal(
        seenDay(now - 7 * 24 * 60 * 60 * 1000, "cs-CZ", "UTC", now),
        "29. 9."
    )
    assert.equal(seenDay("", "cs-CZ", "UTC", now), undefined)
})
