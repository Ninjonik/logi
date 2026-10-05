import assert from "node:assert/strict"
import test from "node:test"

import {
    applyClanSettingsSlicePatches,
    clanSettingsSliceJsonSchemas,
    readClanSettingsSlices,
} from "./settings-slices"
import { commandsSettingsSlice } from "./commands-settings-slice"
import { CLAN_SETTINGS_SLICES } from "./clan-settings-slices"

const ROLE = "100000000000000005"
const CHANNEL = "200000000000000001"

test("the commands slice is in /api/v1 clan settings (N3-B10)", () => {
    assert.ok(CLAN_SETTINGS_SLICES.some((slice) => slice.key === "commands"))
    const schemas = clanSettingsSliceJsonSchemas(CLAN_SETTINGS_SLICES)
    assert.ok(schemas.ClanSettingsCommandsSlice)
    assert.ok(schemas.ClanSettingsCommandsPatch)
    assert.match(
        String(schemas.ClanSettingsCommandsSlice!.description),
        /not part of the API/
    )
})

test("GET returns every command with defaults, /stats with its games and Share channel", () => {
    const slices = readClanSettingsSlices(
        {
            discordConfig: {
                statsSettings: {
                    enabled: false,
                    games: { hell_let_loose: true, wardogs: false },
                    defaultShareChannelId: CHANNEL,
                },
                commandSettings: { serverStatus: { roleIds: [ROLE] } },
            },
        },
        CLAN_SETTINGS_SLICES
    )
    const commands = slices.commands as Record<string, Record<string, unknown>>
    assert.deepEqual(commands.stats, {
        enabled: false,
        audience: "everyone",
        roleIds: [],
        reply: "privateShare",
        channelIds: [],
        games: { hell_let_loose: true, wardogs: false },
        shareChannelId: CHANNEL,
    })
    assert.deepEqual(commands["server-status"]!.roleIds, [ROLE])
    assert.equal(commands.help!.enabled, true)
    assert.ok(commandsSettingsSlice.schema.safeParse(commands).success)
})

test("PATCH writes the command settings and only touches /stats's settings when asked", () => {
    const source = {
        discordConfig: {
            statsSettings: {
                enabled: true,
                games: { hell_let_loose: true, wardogs: true },
                defaultShareChannelId: CHANNEL,
            },
        },
    }
    const onlyPlayer = applyClanSettingsSlicePatches(
        { commands: { player: { audience: "clanMembers", roleIds: [ROLE] } } },
        source,
        CLAN_SETTINGS_SLICES
    )
    assert.ok(onlyPlayer.ok)
    if (!onlyPlayer.ok) return
    assert.deepEqual(Object.keys(onlyPlayer.patch), ["commandSettings"])
    const stored = onlyPlayer.patch.commandSettings as Record<
        string,
        Record<string, unknown>
    >
    assert.equal(stored.player!.audience, "clanMembers")
    assert.deepEqual(stored.player!.roleIds, [ROLE])

    const stats = applyClanSettingsSlicePatches(
        {
            commands: {
                stats: {
                    enabled: false,
                    games: { wardogs: false },
                    shareChannelId: null,
                },
            },
        },
        source,
        CLAN_SETTINGS_SLICES
    )
    assert.ok(stats.ok)
    if (!stats.ok) return
    assert.deepEqual(stats.patch.statsSettings, {
        enabled: false,
        games: { hell_let_loose: true, wardogs: false },
    })
})

test("PATCH refuses what a command does not offer", () => {
    for (const commands of [
        { link: { audience: "logiAdmins" } },
        { "server-status": { reply: "privateShare" } },
        { help: { channelIds: ["#general"] } },
        { stats: { games: { hll: true } } },
        { reregister: true },
    ]) {
        const result = applyClanSettingsSlicePatches(
            { commands },
            { discordConfig: null },
            CLAN_SETTINGS_SLICES
        )
        assert.equal(result.ok, false, JSON.stringify(commands))
    }
})
