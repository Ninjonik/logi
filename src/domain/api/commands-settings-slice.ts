import { z } from "zod"

import {
    applyCommandSettingsPatch,
    patchEntry,
    resolveCommandSettings,
    storeCommandSettings,
    type CommandSettingsPatch,
} from "../discord-commands/command-settings"
import {
    COMMAND_AUDIENCES,
    COMMAND_REPLY_MODES,
    CONFIGURABLE_COMMANDS,
} from "../discord-commands/catalog"
import {
    DEFAULT_STATS_COMMAND_SETTINGS,
    statsCommandSettingsSchema,
} from "../player-stats/command-settings"
import { defineClanSettingsSlice } from "./settings-slices"

const snowflake = z.string().regex(/^\d{17,20}$/)

const entrySchema = z.object({
    enabled: z.boolean(),
    audience: z.enum(COMMAND_AUDIENCES),
    roleIds: z.array(snowflake),
    reply: z.enum(COMMAND_REPLY_MODES),
    channelIds: z.array(snowflake),
})

const statsEntrySchema = entrySchema.extend({
    games: z.object({ hell_let_loose: z.boolean(), wardogs: z.boolean() }),
    shareChannelId: snowflake.nullable(),
})

const statsPatchSchema = patchEntry("stats").extend({
    games: z
        .strictObject({ hell_let_loose: z.boolean(), wardogs: z.boolean() })
        .partial()
        .optional(),
    shareChannelId: snowflake.nullable().optional(),
})

function statsSettingsOf(
    discordConfig: Readonly<Record<string, unknown>> | null
) {
    const parsed = statsCommandSettingsSchema.safeParse(
        discordConfig?.statsSettings
    )
    return parsed.success ? parsed.data : DEFAULT_STATS_COMMAND_SETTINGS
}

/**
 * The "Příkazy" page in `/api/v1` (N3-B10): per command whether it is on,
 * who may use it (a group and extra roles), where the reply lands and the
 * channels it works in; `/stats` also has its games and Share channel. The
 * bot registers the commands again by itself after a change. Re-registering
 * on demand is a live Discord action and is deliberately not in the API.
 */
export const commandsSettingsSlice = defineClanSettingsSlice({
    key: "commands",
    description:
        "Discord slash commands: per command on/off, who may use it (everyone, clan members or Logi managers, plus extra role IDs), the reply mode and the allowed channel IDs (empty means every channel); /stats also has its games and Share channel. The bot re-registers the commands after a change; triggering a registration is not part of the API.",
    schema: z.object({
        help: entrySchema,
        stats: statsEntrySchema,
        player: entrySchema,
        link: entrySchema,
        notice: entrySchema,
        "server-status": entrySchema,
    }),
    patchSchema: z
        .strictObject({
            help: patchEntry("help"),
            stats: statsPatchSchema,
            player: patchEntry("player"),
            link: patchEntry("link"),
            notice: patchEntry("notice"),
            "server-status": patchEntry("server-status"),
        })
        .partial(),
    read: ({ discordConfig }) => {
        const stats = statsSettingsOf(discordConfig)
        const settings = resolveCommandSettings(
            discordConfig?.commandSettings,
            stats.enabled
        )
        return {
            help: settings.help,
            stats: {
                ...settings.stats,
                games: { ...stats.games },
                shareChannelId: stats.defaultShareChannelId ?? null,
            },
            player: settings.player,
            link: settings.link,
            notice: settings.notice,
            "server-status": settings["server-status"],
        }
    },
    toPatch: (patch, { discordConfig }) => {
        const stats = statsSettingsOf(discordConfig)
        const current = resolveCommandSettings(
            discordConfig?.commandSettings,
            stats.enabled
        )
        const commandPatch: Record<string, unknown> = {}
        for (const command of CONFIGURABLE_COMMANDS) {
            const change = patch[command]
            if (!change) continue
            // The /stats extras are stored apart, in the stats settings.
            commandPatch[command] = Object.fromEntries(
                Object.entries(change).filter(
                    ([key]) => key !== "games" && key !== "shareChannelId"
                )
            )
        }
        const next = applyCommandSettingsPatch(
            current,
            commandPatch as CommandSettingsPatch
        )
        const statsChange = patch.stats
        if (
            !statsChange ||
            (statsChange.enabled === undefined &&
                statsChange.games === undefined &&
                statsChange.shareChannelId === undefined)
        )
            return { commandSettings: storeCommandSettings(next) }
        const shareChannelId =
            statsChange.shareChannelId === undefined
                ? stats.defaultShareChannelId
                : (statsChange.shareChannelId ?? undefined)
        return {
            commandSettings: storeCommandSettings(next),
            statsSettings: statsCommandSettingsSchema.parse({
                enabled: next.stats.enabled,
                games: { ...stats.games, ...statsChange.games },
                ...(shareChannelId
                    ? { defaultShareChannelId: shareChannelId }
                    : {}),
            }),
        }
    },
})
