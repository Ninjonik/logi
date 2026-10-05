import assert from "node:assert/strict"
import test from "node:test"

import { formatRelativeTime } from "@/lib/format/relative-time"

const now = Date.parse("2026-10-05T12:00:00Z")

test("recent instants read as minutes, hours or days ago", () => {
    assert.equal(
        formatRelativeTime("2026-10-05T11:30:00Z", now, "en"),
        "30 min. ago"
    )
    assert.equal(
        formatRelativeTime("2026-10-05T10:00:00Z", now, "en"),
        "2 hr. ago"
    )
    assert.equal(
        formatRelativeTime("2026-10-04T12:00:00Z", now, "en"),
        "yesterday"
    )
    assert.equal(
        formatRelativeTime("2026-10-02T12:00:00Z", now, "en"),
        "3 days ago"
    )
})

test("old, future and invalid instants fall back", () => {
    assert.equal(
        formatRelativeTime("2026-09-01T12:00:00Z", now, "en"),
        "9/1/2026"
    )
    assert.equal(
        formatRelativeTime("2026-10-06T12:00:00Z", now, "en"),
        "10/6/2026"
    )
    assert.equal(formatRelativeTime("not a date", now, "en"), "not a date")
})

test("other languages use their own wording", () => {
    assert.match(formatRelativeTime("2026-10-05T10:00:00Z", now, "cs"), /2/)
})
