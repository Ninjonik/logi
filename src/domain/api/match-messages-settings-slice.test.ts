import assert from "node:assert/strict"
import test from "node:test"

import {
    applyClanSettingsSlicePatches,
    clanSettingsSliceJsonSchemas,
    readClanSettingsSlices,
} from "./settings-slices"
import { matchMessagesSettingsSlice } from "./match-messages-settings-slice"
import { CLAN_SETTINGS_SLICES } from "./clan-settings-slices"

test("GET returns the match message defaults when nothing is stored", () => {
    assert.deepEqual(
        readClanSettingsSlices({ discordConfig: null }, CLAN_SETTINGS_SLICES)
            .matchMessages,
        {
            rosterMessageVariant: "photo_text",
            rosterChangesPost: true,
            rosterChangesDm: true,
            attendanceNoticesInThread: false,
        }
    )
})

test("PATCH writes only the supplied fields under their stored names", () => {
    const result = applyClanSettingsSlicePatches(
        {
            matchMessages: {
                rosterMessageVariant: "photo",
                attendanceNoticesInThread: true,
            },
        },
        { discordConfig: { rosterChangesDmDefault: false } },
        CLAN_SETTINGS_SLICES
    )
    assert.deepEqual(result, {
        ok: true,
        changed: true,
        patch: {
            rosterMessageVariant: "photo",
            attendanceNoticesInThread: true,
        },
    })
    const read = matchMessagesSettingsSlice.read({
        discordConfig: {
            rosterMessageVariant: "photo",
            rosterChangesDmDefault: false,
        },
    })
    assert.equal(read.rosterMessageVariant, "photo")
    assert.equal(read.rosterChangesDm, false)
})

test("PATCH refuses unknown variants and the per-publish options", () => {
    for (const body of [
        { rosterMessageVariant: "video" },
        { mentionPlayers: true },
        { rosterChangesPost: "yes" },
    ]) {
        const result = applyClanSettingsSlicePatches(
            { matchMessages: body },
            { discordConfig: null },
            CLAN_SETTINGS_SLICES
        )
        assert.equal(result.ok, false)
    }
})

test("OpenAPI documents the slice and its patch", () => {
    const schemas = clanSettingsSliceJsonSchemas(CLAN_SETTINGS_SLICES)
    assert.ok(schemas.ClanSettingsMatchMessagesSlice)
    assert.ok(schemas.ClanSettingsMatchMessagesPatch)
})
