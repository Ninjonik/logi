import assert from "node:assert/strict"
import test from "node:test"

import { isClanApiResourceDocument } from "./resource-document"

test("resource document checks distinguish groups from same-guild calendar items", () => {
    const calendarItem = {
        guildId: "guild-1",
        title: "Community night",
        color: "#22c55e",
        startAt: "2026-10-01T18:00:00.000Z",
        endAt: "2026-10-01T20:00:00.000Z",
    }

    assert.equal(
        isClanApiResourceDocument("calendar-items", calendarItem),
        true
    )
    assert.equal(isClanApiResourceDocument("groups", calendarItem), false)
})

test("resource document checks require each resource's persisted identity fields", () => {
    assert.equal(
        isClanApiResourceDocument("events", {
            name: "Operation",
            registrationEnd: "2026-10-01T16:00:00.000Z",
            meetingStart: "2026-10-01T17:00:00.000Z",
            gameEnd: "2026-10-01T20:00:00.000Z",
        }),
        true
    )
    assert.equal(
        isClanApiResourceDocument("articles", {
            title: "News",
            body: "Text",
        }),
        false
    )
})

test("an unpublished draft event is not an API document", () => {
    const event = {
        name: "Draft",
        registrationEnd: "2026-10-10T18:00:00.000Z",
        meetingStart: "2026-10-11T18:00:00.000Z",
        gameEnd: "2026-10-11T20:00:00.000Z",
    }
    assert.equal(isClanApiResourceDocument("events", event), true)
    assert.equal(
        isClanApiResourceDocument("events", { ...event, isDraft: true }),
        false
    )
})
