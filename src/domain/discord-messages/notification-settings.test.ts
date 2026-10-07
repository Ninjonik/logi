import assert from "node:assert/strict"
import test from "node:test"

import {
    DEFAULT_MATCH_MESSAGE_SETTINGS,
    DEFAULT_MESSAGE_SWITCHES,
    MESSAGE_SWITCH_FIELDS,
    MESSAGE_SWITCH_KEYS,
    isMessageEnabled,
    messageSettingsPatch,
    resolveMatchMessageSettings,
    resolveMessageSettings,
    resolveMessageSwitches,
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

test("every message switch is on until the clan turns it off (N1-B06)", () => {
    assert.deepEqual(resolveMessageSwitches(null), DEFAULT_MESSAGE_SWITCHES)
    assert.ok(Object.values(DEFAULT_MESSAGE_SWITCHES).every(Boolean))
    assert.deepEqual(
        resolveMessageSwitches({
            debriefPostEnabled: false,
            scheduledEventEnabled: "no",
            ticketCloseDmEnabled: false,
        }),
        {
            debriefPost: false,
            scheduledEvent: true,
            matchRecapDm: true,
            trainingResultDm: true,
            applicationCloseDm: true,
            ticketCloseDm: false,
        }
    )
    assert.equal(
        isMessageEnabled({ matchRecapDmEnabled: false }, "matchRecapDm"),
        false
    )
    assert.equal(isMessageEnabled(undefined, "trainingResultDm"), true)
})

test("the page's settings combine the match settings and the switches", () => {
    assert.deepEqual(resolveMessageSettings(null), {
        ...DEFAULT_MATCH_MESSAGE_SETTINGS,
        ...DEFAULT_MESSAGE_SWITCHES,
    })
    assert.equal(
        resolveMessageSettings({ attendanceNoticesInThread: true })
            .attendanceNoticesInThread,
        true
    )
})

test("a change maps to the stored field names and leaves out the rest", () => {
    assert.deepEqual(
        messageSettingsPatch({
            rosterMessageVariant: "photo",
            rosterChangesPost: false,
            attendanceNoticesInThread: true,
            debriefPost: false,
            applicationCloseDm: true,
        }),
        {
            rosterMessageVariant: "photo",
            rosterChangesPostDefault: false,
            attendanceNoticesInThread: true,
            debriefPostEnabled: false,
            applicationCloseDmEnabled: true,
        }
    )
    assert.deepEqual(messageSettingsPatch({}), {})
    assert.deepEqual(
        messageSettingsPatch({
            rosterMessageVariant: "video" as never,
        }),
        {}
    )
    for (const key of MESSAGE_SWITCH_KEYS)
        assert.match(MESSAGE_SWITCH_FIELDS[key], /Enabled$/)
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
