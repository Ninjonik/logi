import assert from "node:assert/strict"
import test from "node:test"

import {
    applyClanSettingsSlicePatches,
    clanSettingsSliceJsonSchemas,
    readClanSettingsSlices,
} from "./settings-slices"
import { CLAN_SETTINGS_SLICES } from "./clan-settings-slices"

test("GET returns the clan look and every switch on when nothing is stored (N1-B10)", () => {
    assert.deepEqual(
        readClanSettingsSlices({ discordConfig: null }, CLAN_SETTINGS_SLICES)
            .messages,
        {
            accentColor: null,
            iconDensity: "sparse",
            debriefPost: true,
            scheduledEvent: true,
            matchRecapDm: true,
            trainingResultDm: true,
            applicationCloseDm: true,
            ticketCloseDm: true,
        }
    )
    assert.deepEqual(
        readClanSettingsSlices(
            {
                discordConfig: {
                    messageStyle: {
                        accentColor: "#123abc",
                        iconDensity: "rich",
                    },
                    ticketCloseDmEnabled: false,
                },
            },
            CLAN_SETTINGS_SLICES
        ).messages,
        {
            accentColor: "#123ABC",
            iconDensity: "rich",
            debriefPost: true,
            scheduledEvent: true,
            matchRecapDm: true,
            trainingResultDm: true,
            applicationCloseDm: true,
            ticketCloseDm: false,
        }
    )
})

test("PATCH writes the switches under their stored names and keeps the other half of the style", () => {
    assert.deepEqual(
        applyClanSettingsSlicePatches(
            { messages: { debriefPost: false, matchRecapDm: true } },
            { discordConfig: null },
            CLAN_SETTINGS_SLICES
        ),
        {
            ok: true,
            changed: true,
            patch: { debriefPostEnabled: false, matchRecapDmEnabled: true },
        }
    )
    assert.deepEqual(
        applyClanSettingsSlicePatches(
            { messages: { iconDensity: "rich" } },
            {
                discordConfig: {
                    messageStyle: {
                        accentColor: "#123456",
                        iconDensity: "sparse",
                    },
                },
            },
            CLAN_SETTINGS_SLICES
        ),
        {
            ok: true,
            changed: true,
            patch: {
                messageStyle: { iconDensity: "rich", accentColor: "#123456" },
            },
        }
    )
    assert.deepEqual(
        applyClanSettingsSlicePatches(
            { messages: { accentColor: null } },
            {
                discordConfig: {
                    messageStyle: {
                        accentColor: "#123456",
                        iconDensity: "rich",
                    },
                },
            },
            CLAN_SETTINGS_SLICES
        ),
        {
            ok: true,
            changed: true,
            patch: { messageStyle: { iconDensity: "rich" } },
        }
    )
})

test("PATCH refuses bad colours, unknown fields and the errors channel (a plain field)", () => {
    for (const body of [
        { accentColor: "orange" },
        { iconDensity: "many" },
        { errorsChannelId: "123" },
        { ticketCloseDm: "no" },
    ]) {
        const result = applyClanSettingsSlicePatches(
            { messages: body },
            { discordConfig: null },
            CLAN_SETTINGS_SLICES
        )
        assert.equal(result.ok, false, JSON.stringify(body))
    }
})

test("OpenAPI documents the slice and its patch", () => {
    const schemas = clanSettingsSliceJsonSchemas(CLAN_SETTINGS_SLICES)
    assert.ok(schemas.ClanSettingsMessagesSlice)
    assert.ok(schemas.ClanSettingsMessagesPatch)
})
