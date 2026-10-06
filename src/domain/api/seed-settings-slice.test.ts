import assert from "node:assert/strict"
import test from "node:test"

import { defaultSeedPlanSettings } from "../discord-seed/plan"

import {
    mergeSeedPlanPatch,
    seedSettingsApiError,
    seedSettingsPatchSchema,
    seedSettingsSlice,
} from "./seed-settings-slice"
import { CLAN_SETTINGS_SLICES } from "./clan-settings-slices"

test("the seed slice is registered as an external slice", () => {
    assert.ok(CLAN_SETTINGS_SLICES.includes(seedSettingsSlice))
    assert.equal(seedSettingsSlice.external, true)
    assert.deepEqual(
        seedSettingsSlice.toPatch(
            { servers: [] },
            {
                discordConfig: null,
            }
        ),
        {}
    )
    assert.deepEqual(seedSettingsSlice.read({ discordConfig: null }), {
        servers: [],
    })
})

test("PATCH takes some fields of some servers and refuses the rest", () => {
    assert.equal(
        seedSettingsPatchSchema.safeParse({
            servers: [
                {
                    connectionId: "c1",
                    expectedRevision: 2,
                    settings: { liveFrom: 45, cooldownMinutes: 90 },
                },
            ],
        }).success,
        true
    )
    for (const body of [
        { servers: [] },
        { servers: [{ connectionId: "c1", settings: { state: {} } }] },
        { servers: [{ connectionId: "c1", settings: { liveFrom: 1 } }] },
        {
            servers: [
                { connectionId: "c1", settings: { seedChannelId: "#seed" } },
            ],
        },
        {
            servers: [
                { connectionId: "c1", settings: {} },
                { connectionId: "c1", settings: {} },
            ],
        },
        { servers: [{ connectionId: "c1", settings: {} }], start: true },
    ])
        assert.equal(
            seedSettingsPatchSchema.safeParse(body).success,
            false,
            JSON.stringify(body)
        )
})

test("a patch replaces only the supplied fields of the stored plan", () => {
    const merged = mergeSeedPlanPatch(null, {
        enabled: true,
        seedChannelId: "111111111111111111",
        auto: { enabled: true, below: 15, from: "16:00", to: "21:00" },
    })
    assert.deepEqual(merged, {
        ...defaultSeedPlanSettings(),
        enabled: true,
        seedChannelId: "111111111111111111",
        auto: { enabled: true, below: 15, from: "16:00", to: "21:00" },
    })
    const stored = { ...defaultSeedPlanSettings(), template: "Pojďte" }
    assert.equal(
        mergeSeedPlanPatch(stored, { template: null }).template,
        null,
        "null clears the text"
    )
    assert.equal(mergeSeedPlanPatch(stored, {}).template, "Pojďte")
})

test("store errors name the server and the field", () => {
    assert.deepEqual(seedSettingsApiError({ kind: "conflict", index: 1 }), {
        status: 409,
        code: "conflict",
        message:
            "seed.servers.1.expectedRevision: the seed plan changed since that revision.",
    })
    assert.deepEqual(
        seedSettingsApiError({
            kind: "invalid",
            index: 0,
            issues: [
                { path: "startBelow", code: "start_below_not_under_live" },
            ],
        }),
        {
            status: 400,
            code: "validation_error",
            message:
                "seed.servers.0.settings.startBelow: start_below_not_under_live.",
        }
    )
    assert.equal(
        seedSettingsApiError({ kind: "unknown_server", index: 0 }).status,
        400
    )
})
