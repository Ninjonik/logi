import assert from "node:assert/strict"
import test from "node:test"

import { eventDraftActionError, isDraftEvent, withoutDrafts } from "./drafts"

test("only an explicit draft flag marks a draft", () => {
    assert.equal(isDraftEvent({ isDraft: true }), true)
    assert.equal(isDraftEvent({ isDraft: false }), false)
    assert.equal(isDraftEvent({}), false)
    assert.equal(isDraftEvent(null), false)
})

test("published reads drop drafts and keep legacy events", () => {
    const events = [
        { id: "a" },
        { id: "b", isDraft: true },
        { id: "c", isDraft: false },
    ]
    assert.deepEqual(
        withoutDrafts(events).map((event) => event.id),
        ["a", "c"]
    )
})

test("draft actions need a draft of the same clan", () => {
    assert.equal(
        eventDraftActionError({ guildId: "1", isDraft: true }, "1"),
        null
    )
    assert.equal(eventDraftActionError(null, "1"), "not_found")
    // Another clan's draft reads as missing, never as a different error.
    assert.equal(
        eventDraftActionError({ guildId: "2", isDraft: true }, "1"),
        "not_found"
    )
    // A published event can never be overwritten as a draft or deleted here.
    assert.equal(eventDraftActionError({ guildId: "1" }, "1"), "not_draft")
})
