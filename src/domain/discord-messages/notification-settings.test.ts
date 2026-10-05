import assert from "node:assert/strict"
import test from "node:test"

import {
    DEFAULT_MATCH_MESSAGE_SETTINGS,
    resolveMatchMessageSettings,
    resolveRosterMessageVariant,
} from "./notification-settings"

test("missing settings read the board's defaults", () => {
    assert.deepEqual(resolveMatchMessageSettings(null), {
        rosterMessageVariant: "photo_text",
        rosterChangesPost: true,
        rosterChangesDm: true,
        attendanceNoticesInThread: false,
    })
    assert.deepEqual(
        resolveMatchMessageSettings({ rosterMessageVariant: "bogus" }),
        DEFAULT_MATCH_MESSAGE_SETTINGS
    )
})

test("stored settings win over the defaults", () => {
    assert.deepEqual(
        resolveMatchMessageSettings({
            rosterMessageVariant: "photo",
            rosterChangesPostDefault: false,
            rosterChangesDmDefault: false,
            attendanceNoticesInThread: true,
        }),
        {
            rosterMessageVariant: "photo",
            rosterChangesPost: false,
            rosterChangesDm: false,
            attendanceNoticesInThread: true,
        }
    )
})

test("a publish's own choice wins over the clan default", () => {
    assert.equal(resolveRosterMessageVariant("photo", null), "photo")
    assert.equal(
        resolveRosterMessageVariant(undefined, {
            rosterMessageVariant: "photo",
        }),
        "photo"
    )
    assert.equal(resolveRosterMessageVariant(undefined, {}), "photo_text")
})
