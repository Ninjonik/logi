import assert from "node:assert/strict"
import test from "node:test"

import {
    DEFAULT_COMMAND_SETTINGS,
    applyCommandSettingsPatch,
    changedCommands,
    commandSettingsPatchSchema,
    resolveCommandSettings,
    storeCommandSettings,
    storedCommandSettingsSchema,
} from "./command-settings"

const ROLE = "100000000000000005"
const CHANNEL = "200000000000000001"

test("without stored settings every command is on, private, everywhere; /server-status is for managers", () => {
    const settings = resolveCommandSettings(undefined, undefined)
    assert.deepEqual(settings, DEFAULT_COMMAND_SETTINGS)
    assert.equal(settings.stats.reply, "privateShare")
    assert.equal(settings.player.reply, "privateShare")
    assert.equal(settings["server-status"].audience, "logiAdmins")
    assert.equal(settings.help.audience, "everyone")
})

test("/stats's switch comes from statsSettings, not from the command settings", () => {
    assert.equal(resolveCommandSettings({}, false).stats.enabled, false)
    assert.equal(resolveCommandSettings({}, true).stats.enabled, true)
    assert.equal(
        storedCommandSettingsSchema.safeParse({ stats: { enabled: false } })
            .success,
        false
    )
})

test("a value a command does not offer falls back to the design default", () => {
    const settings = resolveCommandSettings(
        {
            help: { audience: "logiAdmins", reply: "privateShare" },
            serverStatus: { reply: "privateShare", roleIds: [ROLE] },
            player: { audience: "everyone", roleIds: [ROLE] },
        },
        true
    )
    assert.equal(settings.help.audience, "everyone")
    assert.equal(settings.help.reply, "private")
    assert.equal(settings["server-status"].reply, "private")
    assert.deepEqual(settings["server-status"].roleIds, [ROLE])
    assert.deepEqual(
        settings.player.roleIds,
        [],
        "extra roles only on top of a restricted group"
    )
})

test("a broken stored record reads as the defaults", () => {
    assert.deepEqual(
        resolveCommandSettings({ help: { channelIds: ["#chan"] } }, true),
        DEFAULT_COMMAND_SETTINGS
    )
})

test("settings round-trip through the stored shape without /stats's switch", () => {
    const settings = applyCommandSettingsPatch(DEFAULT_COMMAND_SETTINGS, {
        stats: { channelIds: [CHANNEL, CHANNEL], enabled: false },
        "server-status": { roleIds: [ROLE] },
    })
    const stored = storeCommandSettings(settings)
    assert.equal("enabled" in (stored.stats ?? {}), false)
    assert.deepEqual(stored.stats?.channelIds, [CHANNEL], "duplicates drop")
    assert.deepEqual(resolveCommandSettings(stored, false), settings)
})

test("the patch schema accepts only what each command offers", () => {
    assert.equal(
        commandSettingsPatchSchema.safeParse({
            player: { audience: "clanMembers" },
        }).success,
        true
    )
    assert.equal(
        commandSettingsPatchSchema.safeParse({
            link: { audience: "logiAdmins" },
        }).success,
        false
    )
    assert.equal(
        commandSettingsPatchSchema.safeParse({
            "server-status": { reply: "privateShare" },
        }).success,
        false
    )
    assert.equal(
        commandSettingsPatchSchema.safeParse({ help: { channelIds: ["x"] } })
            .success,
        false
    )
    assert.equal(
        commandSettingsPatchSchema.safeParse({ unknown: {} }).success,
        false
    )
})

test("the save bar counts changed commands", () => {
    const next = applyCommandSettingsPatch(DEFAULT_COMMAND_SETTINGS, {
        help: { enabled: false },
        player: { reply: "private" },
    })
    assert.deepEqual(changedCommands(next, DEFAULT_COMMAND_SETTINGS), [
        "help",
        "player",
    ])
})
