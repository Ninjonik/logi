import assert from "node:assert/strict"
import test from "node:test"

import { z } from "zod"

import {
    applyClanSettingsSlicePatches,
    assertClanSettingsSlices,
    clanSettingsSliceJsonSchemas,
    clanSettingsSlicesPatch,
    defineClanSettingsSlice,
    readClanSettingsSlices,
    type AnyClanSettingsSlice,
} from "./settings-slices"
import { CLAN_SETTINGS_SLICES } from "./clan-settings-slices"
import { parseClanSettingsPatch } from "./settings-patch"

/**
 * A slice as a later workstream writes it: one module with a schema, a patch
 * schema, a read mapper and a patch mapper. Nothing else is edited.
 */
const exampleSlice = defineClanSettingsSlice({
    key: "examplePanel",
    description: "An example panel's settings.",
    schema: z.object({
        enabled: z.boolean(),
        refreshSeconds: z.literal(60),
        channelId: z.string().nullable(),
    }),
    patchSchema: z
        .object({
            enabled: z.boolean(),
            channelId: z.string().regex(/^\d+$/).nullable(),
        })
        .partial()
        .strict(),
    read: ({ discordConfig }) => ({
        enabled: discordConfig?.examplePanelEnabled === true,
        refreshSeconds: 60 as const,
        channelId:
            typeof discordConfig?.examplePanelChannelId === "string"
                ? discordConfig.examplePanelChannelId
                : null,
    }),
    toPatch: (patch) => ({
        ...(patch.enabled === undefined
            ? {}
            : { examplePanelEnabled: patch.enabled }),
        ...(patch.channelId === undefined
            ? {}
            : { examplePanelChannelId: patch.channelId ?? undefined }),
    }),
})
const slices: readonly AnyClanSettingsSlice[] = [exampleSlice]
const source = {
    discordConfig: { examplePanelEnabled: true, examplePanelChannelId: "42" },
}

test("the shipped registry is valid and holds the redesign slices", () => {
    assert.doesNotThrow(() => assertClanSettingsSlices(CLAN_SETTINGS_SLICES))
    assert.ok(
        CLAN_SETTINGS_SLICES.some((slice) => slice.key === "panelGraphics")
    )
    assert.ok(
        CLAN_SETTINGS_SLICES.some((slice) => slice.key === "commands")
    )
})

test("adding one slice module makes PATCH accept it next to the plain fields", () => {
    assert.deepEqual(
        parseClanSettingsPatch(
            {
                timezone: "Europe/Prague",
                examplePanel: { enabled: false, channelId: "123" },
            },
            slices
        ),
        {
            ok: true,
            value: {
                timezone: "Europe/Prague",
                slices: { examplePanel: { enabled: false, channelId: "123" } },
            },
        }
    )
    assert.deepEqual(
        parseClanSettingsPatch({ examplePanel: { channelId: null } }, slices),
        { ok: true, value: { slices: { examplePanel: { channelId: null } } } }
    )
})

test("a slice validates its own values and refuses unknown fields", () => {
    assert.deepEqual(
        parseClanSettingsPatch(
            { examplePanel: { channelId: "general" } },
            slices
        ),
        {
            ok: false,
            error: "examplePanel.channelId: Invalid string: must match pattern /^\\d+$/",
        }
    )
    assert.equal(
        parseClanSettingsPatch({ examplePanel: { secret: "x" } }, slices).ok,
        false
    )
    assert.equal(
        parseClanSettingsPatch({ examplePanel: "on" }, slices).ok,
        false
    )
    // Without the module the key is an unsupported field, as before.
    assert.deepEqual(parseClanSettingsPatch({ examplePanel: {} }), {
        ok: false,
        error: "Settings patch contains an unsupported field.",
    })
})

test("GET reads every slice and PATCH maps it to Discord configuration fields", () => {
    assert.deepEqual(readClanSettingsSlices(source, slices), {
        examplePanel: { enabled: true, refreshSeconds: 60, channelId: "42" },
    })
    assert.deepEqual(readClanSettingsSlices({ discordConfig: null }, slices), {
        examplePanel: { enabled: false, refreshSeconds: 60, channelId: null },
    })
    assert.deepEqual(
        clanSettingsSlicesPatch(
            { examplePanel: { enabled: false, channelId: null } },
            source,
            slices
        ),
        { examplePanelEnabled: false, examplePanelChannelId: undefined }
    )
})

test("the Convex side validates again and reports the change", () => {
    assert.deepEqual(applyClanSettingsSlicePatches(undefined, source, slices), {
        ok: true,
        patch: {},
        changed: false,
    })
    assert.deepEqual(
        applyClanSettingsSlicePatches(
            { examplePanel: { enabled: true } },
            source,
            slices
        ),
        { ok: true, patch: { examplePanelEnabled: true }, changed: true }
    )
    assert.equal(
        applyClanSettingsSlicePatches(
            { examplePanel: { enabled: "yes" } },
            source,
            slices
        ).ok,
        false
    )
    assert.equal(
        applyClanSettingsSlicePatches({ other: {} }, source, slices).ok,
        false
    )
})

test("a slice can never write secrets, identity or another slice's fields", () => {
    const leaky = defineClanSettingsSlice({
        ...exampleSlice,
        key: "leaky",
        toPatch: () => ({ playerStatsServers: [] }),
    })
    assert.throws(
        () => clanSettingsSlicesPatch({ leaky: {} }, source, [leaky]),
        /may not write "playerStatsServers"/
    )
    const twin = defineClanSettingsSlice({ ...exampleSlice, key: "twin" })
    assert.throws(
        () =>
            clanSettingsSlicesPatch(
                {
                    examplePanel: { enabled: true },
                    twin: { enabled: true },
                },
                source,
                [exampleSlice, twin]
            ),
        /both write "examplePanelEnabled"/
    )
})

test("slice keys are checked when the registry loads", () => {
    for (const key of ["timezone", "slices", "Bad", "x", "has-dash"])
        assert.throws(() =>
            assertClanSettingsSlices([{ ...exampleSlice, key }])
        )
    assert.throws(
        () => assertClanSettingsSlices([exampleSlice, exampleSlice]),
        /duplicated/
    )
})

test("each slice contributes its read and patch JSON Schemas", () => {
    const schemas = clanSettingsSliceJsonSchemas(slices)
    assert.deepEqual(Object.keys(schemas), [
        "ClanSettingsExamplePanelSlice",
        "ClanSettingsExamplePanelPatch",
    ])
    const read = schemas.ClanSettingsExamplePanelSlice as {
        properties: Record<string, unknown>
        required: string[]
    }
    assert.deepEqual(read.required.sort(), [
        "channelId",
        "enabled",
        "refreshSeconds",
    ])
    const patch = schemas.ClanSettingsExamplePanelPatch as {
        properties: Record<string, unknown>
        additionalProperties: boolean
    }
    assert.deepEqual(Object.keys(patch.properties), ["enabled", "channelId"])
    assert.equal(patch.additionalProperties, false)
})
