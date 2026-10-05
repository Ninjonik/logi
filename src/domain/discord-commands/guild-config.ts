import { z } from "zod"

import {
    resolveCommandSettings,
    storedCommandSettingsSchema,
    type StoredCommandSettings,
} from "./command-settings"
import {
    statsCommandSettingsSchema,
    type StatsCommandSettings,
} from "../player-stats/command-settings"
import {
    normalizeMessageStyle,
    type MessageStyle,
} from "../discord-messages/message-style"
import type { CommandAccessConfig } from "./permissions"

/**
 * What the bot needs per Discord server to register commands and to check
 * them: the clan language and zone, the command settings, the roles of the
 * permission matrix and the channels `/help` names. Read from Logi through
 * one live Convex query; Discord facts are read separately on each use.
 */
export type GuildCommandConfig = {
    guildId: string
    language: "en" | "cs" | "de"
    timeZone: string
    commandSettings: StoredCommandSettings | null
    statsSettings: StatsCommandSettings | null
    dashboardAdminRoleId: string | null
    clanRoleIds: string[]
    ticketsEnabled: boolean
    ticketSubmitChannelId: string | null
    ticketSupportRoleIds: string[]
    membershipEnabled: boolean
    membershipSubmitChannelId: string | null
    membershipSupportRoleIds: string[]
    announcementsChannelId: string | null
    /** The live score panel's channel per game, for "Živé skóre najdeš v …". */
    liveScoreChannelIds: { hell_let_loose?: string; wardogs?: string }
    /** The clan colour and icon density of every reply. */
    messageStyle: MessageStyle
    registration: {
        requestedAt: number | null
        registeredAt: number | null
        signature: string | null
    }
}

const id = z.string().regex(/^\d{17,20}$/)
const ids = z
    .array(z.string())
    .transform((values) => [
        ...new Set(values.filter((value) => id.safeParse(value).success)),
    ])
const optionalId = z
    .string()
    .nullish()
    .transform((value) => (value && id.safeParse(value).success ? value : null))

/** Validates one row of `discordCommands:listGuildConfigs`. */
export const guildCommandConfigSchema = z.object({
    guildId: z.string().min(1),
    language: z.enum(["en", "cs", "de"]).catch("en"),
    timeZone: z.string().min(1).catch("UTC"),
    commandSettings: z.unknown().transform((value) => {
        const parsed = storedCommandSettingsSchema.safeParse(value)
        return parsed.success ? parsed.data : null
    }),
    statsSettings: z.unknown().transform((value) => {
        const parsed = statsCommandSettingsSchema.safeParse(value)
        return parsed.success ? parsed.data : null
    }),
    dashboardAdminRoleId: optionalId,
    clanRoleIds: ids,
    ticketsEnabled: z.boolean(),
    ticketSubmitChannelId: optionalId,
    ticketSupportRoleIds: ids,
    membershipEnabled: z.boolean(),
    membershipSubmitChannelId: optionalId,
    membershipSupportRoleIds: ids,
    announcementsChannelId: optionalId,
    liveScoreChannelIds: z
        .object({
            hell_let_loose: id.optional(),
            wardogs: id.optional(),
        })
        .catch({}),
    messageStyle: z.unknown().transform((value) =>
        normalizeMessageStyle(
            value && typeof value === "object"
                ? (value as {
                      accentColor?: unknown
                      iconDensity?: unknown
                  })
                : null
        )
    ),
    registration: z.object({
        requestedAt: z.number().nullable(),
        registeredAt: z.number().nullable(),
        signature: z.string().nullable(),
    }),
}) satisfies z.ZodType<GuildCommandConfig, unknown>

/** The permission matrix's input for one server. */
export function commandAccessConfig(
    config: GuildCommandConfig
): CommandAccessConfig {
    return {
        dashboardAdminRoleId: config.dashboardAdminRoleId,
        clanRoleIds: config.clanRoleIds,
        ticketSupportRoleIds: config.ticketSupportRoleIds,
        membershipSupportRoleIds: config.membershipSupportRoleIds,
        ticketsEnabled: config.ticketsEnabled,
        membershipEnabled: config.membershipEnabled,
        settings: resolveCommandSettings(
            config.commandSettings,
            config.statsSettings?.enabled
        ),
    }
}

/** Stored Discord configuration fields the mapping reads. */
type StoredConfig = {
    guildId: string
    defaultLanguage?: string
    timezone?: string
    commandSettings?: unknown
    statsSettings?: unknown
    messageStyle?: unknown
    dashboardAdminRoleId?: string
    clanRoleId?: string
    announcementsChannelId?: string
    ticketSettings?: {
        enabled?: boolean
        submitChannelId?: string
        categories?: ReadonlyArray<{ supportRoleIds?: readonly string[] }>
    }
    membershipSettings?: {
        enabled?: boolean
        submitChannelId?: string
        categories?: ReadonlyArray<{ supportRoleIds?: readonly string[] }>
    }
    gameOverrides?: Record<
        string,
        | {
              clanRoleId?: string
              membershipSettings?: {
                  enabled?: boolean
                  categories?: ReadonlyArray<{
                      supportRoleIds?: readonly string[]
                  }>
              }
          }
        | undefined
    >
}

/**
 * The bot's view of one server from the stored Discord configuration, its
 * registration row and its public panels. Support roles of every ticket and
 * application category (per game too) count for `/help`; the close commands
 * still check the thread's own category when they run.
 */
export function guildCommandConfigFromStored(input: {
    config: StoredConfig
    registration?: {
        requestedAt?: number
        registeredAt?: number
        signature?: string
    } | null
    panels?: ReadonlyArray<{
        gameId: string
        kind: string
        channelId: string
        enabled: boolean
    }>
}): GuildCommandConfig {
    const { config } = input
    const overrides = Object.values(config.gameOverrides ?? {}).filter(
        (value): value is NonNullable<typeof value> => Boolean(value)
    )
    const membershipSettings = [
        config.membershipSettings,
        ...overrides.map((override) => override.membershipSettings),
    ].filter((value): value is NonNullable<typeof value> => Boolean(value))
    const liveScoreChannelIds: GuildCommandConfig["liveScoreChannelIds"] = {}
    for (const panel of input.panels ?? []) {
        if (!panel.enabled || panel.kind === "results") continue
        if (panel.gameId !== "hell_let_loose" && panel.gameId !== "wardogs")
            continue
        liveScoreChannelIds[panel.gameId] ??= panel.channelId
    }
    return guildCommandConfigSchema.parse({
        guildId: config.guildId,
        language: config.defaultLanguage,
        timeZone: config.timezone,
        commandSettings: config.commandSettings,
        statsSettings: config.statsSettings,
        dashboardAdminRoleId: config.dashboardAdminRoleId,
        clanRoleIds: [
            config.clanRoleId,
            ...overrides.map((override) => override.clanRoleId),
        ].filter((value): value is string => Boolean(value)),
        ticketsEnabled: Boolean(config.ticketSettings?.enabled),
        ticketSubmitChannelId: config.ticketSettings?.submitChannelId,
        ticketSupportRoleIds: (config.ticketSettings?.categories ?? []).flatMap(
            (category) => [...(category.supportRoleIds ?? [])]
        ),
        membershipEnabled: membershipSettings.some((settings) =>
            Boolean(settings.enabled)
        ),
        membershipSubmitChannelId: config.membershipSettings?.submitChannelId,
        membershipSupportRoleIds: membershipSettings.flatMap((settings) =>
            (settings.categories ?? []).flatMap((category) => [
                ...(category.supportRoleIds ?? []),
            ])
        ),
        announcementsChannelId: config.announcementsChannelId,
        liveScoreChannelIds,
        messageStyle: config.messageStyle,
        registration: {
            requestedAt: input.registration?.requestedAt ?? null,
            registeredAt: input.registration?.registeredAt ?? null,
            signature: input.registration?.signature ?? null,
        },
    })
}
