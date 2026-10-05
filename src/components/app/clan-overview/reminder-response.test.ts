import assert from "node:assert/strict"
import test from "node:test"

import { queuedReminders } from "./reminder-response"

test("the queued reminder count is read from the route's body", () => {
    assert.equal(queuedReminders({ queued: 12 }), 12)
    assert.equal(queuedReminders({ queued: 0 }), 0)
})

test("anything but a whole, non-negative count is a failure", () => {
    for (const body of [
        null,
        undefined,
        "12",
        {},
        { queued: "12" },
        { queued: -1 },
        { queued: 1.5 },
        { queued: Number.NaN },
        { error: "Forbidden." },
    ])
        assert.equal(queuedReminders(body), null)
})
