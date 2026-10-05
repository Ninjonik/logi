import { z } from "zod"

import {
    COMMAND_AUDIENCES,
    COMMAND_CAPABILITIES,
    COMMAND_REPLY_MODES,
    COMMAND_SETTINGS_KEYS,
    CONFIGURABLE_COMMANDS,
    type CommandAudience,
    type CommandReplyMode,
    type ConfigurableCommand,
} from "./catalog"

/**
 * Per-command settings of the "Příkazy" page (N3-B01): on or off, who may
 * use the command (a group plus extra roles), where the reply lands and the
 * channels it works in. An empty channel list means every channel. `/stats`
 * keeps its on/off switch in `statsSettings` (with its games and share
 * channel), so its entry has no `enabled`.
 */

const snowflake = z.string().regex(/^\d{17,20}$/)
const idList = z
    .array(snowflake)
    .max(25)
    .transform((ids) => [...new Set(ids)])

const audienceSchema = z.enum(COMMAND_AUDIENCES)
const replySchema = z.enum(COMMAND_REPLY_MODES)

/** One command as stored; omitted fields keep their defaults. */
const storedEntry = z.strictObject({
    enabled: z.boolean().optional(),
    audience: audienceSchema.optional(),
    roleIds: idList.optional(),
    reply: replySchema.optional(),
    channelIds: idList.optional(),
})

/** What the clan's Discord configuration stores under `commandSettings`. */
export const storedCommandSettingsSchema = z.strictObject({
    help: storedEntry.optional(),
    stats: storedEntry.omit({ enabled: true }).optional(),
    player: storedEntry.optional(),
    link: storedEntry.optional(),
    notice: storedEntry.optional(),
    serverStatus: storedEntry.optional(),
})
export type StoredCommandSettings = z.infer<typeof storedCommandSettingsSchema>

/** One command with every default applied. */
export type CommandSettingsEntry = {
    enabled: boolean
    audience: CommandAudience
    /** Extra roles that may use the command on top of the audience. */
    roleIds: string[]
    reply: CommandReplyMode
    /** Empty means every channel. */
    channelIds: string[]
}

export type ResolvedCommandSettings = Record<
    ConfigurableCommand,
    CommandSettingsEntry
>

/** The design defaults: everyone, private replies with Sdílet where it exists, every channel. */
export const DEFAULT_COMMAND_SETTINGS: ResolvedCommandSettings = {
    help: entry("everyone", "private"),
    stats: entry("everyone", "privateShare"),
    player: entry("everyone", "privateShare"),
    link: entry("everyone", "private"),
    notice: entry("everyone", "private"),
    "server-status": entry("logiAdmins", "private"),
}

function entry(
    audience: CommandAudience,
    reply: CommandReplyMode
): CommandSettingsEntry {
    return { enabled: true, audience, roleIds: [], reply, channelIds: [] }
}

/**
 * The stored settings with every default applied. A value a command does
 * not offer (an audience for `/link`, Sdílet for `/server-status`) falls back
 * to the design default, so a hand-edited record cannot widen access.
 */
export function resolveCommandSettings(
    stored: unknown,
    statsEnabled: boolean | undefined
): ResolvedCommandSettings {
    const parsed = storedCommandSettingsSchema.safeParse(stored ?? {})
    const value: StoredCommandSettings = parsed.success ? parsed.data : {}
    const result = {} as ResolvedCommandSettings
    for (const command of CONFIGURABLE_COMMANDS) {
        const defaults = DEFAULT_COMMAND_SETTINGS[command]
        const saved = value[COMMAND_SETTINGS_KEYS[command]] as
            (Partial<CommandSettingsEntry> & { enabled?: boolean }) | undefined
        const capabilities = COMMAND_CAPABILITIES[command]
        const audience =
            saved?.audience && capabilities.audience?.includes(saved.audience)
                ? saved.audience
                : defaults.audience
        const reply =
            saved?.reply && capabilities.reply?.includes(saved.reply)
                ? saved.reply
                : defaults.reply
        result[command] = {
            enabled:
                command === "stats"
                    ? (statsEnabled ?? true)
                    : (saved?.enabled ?? defaults.enabled),
            audience,
            // Extra roles only make sense on top of a restricted group.
            roleIds:
                capabilities.audience && audience !== "everyone"
                    ? [...(saved?.roleIds ?? [])]
                    : [],
            reply,
            channelIds: [...(saved?.channelIds ?? [])],
        }
    }
    return result
}

/** Resolved settings back to the stored shape, without `/stats`'s switch. */
export function storeCommandSettings(
    settings: ResolvedCommandSettings
): StoredCommandSettings {
    const stored: Record<string, unknown> = {}
    for (const command of CONFIGURABLE_COMMANDS) {
        const current = settings[command]
        const value: Record<string, unknown> = {
            audience: current.audience,
            roleIds: current.roleIds,
            reply: current.reply,
            channelIds: current.channelIds,
        }
        if (command !== "stats") value.enabled = current.enabled
        stored[COMMAND_SETTINGS_KEYS[command]] = value
    }
    return storedCommandSettingsSchema.parse(stored)
}

/**
 * One command in a PATCH (dashboard and `/api/v1`): every field optional,
 * only what the command offers is accepted.
 */
export function patchEntry(command: ConfigurableCommand) {
    const capabilities = COMMAND_CAPABILITIES[command]
    return z
        .strictObject({
            enabled: z.boolean(),
            audience: capabilities.audience
                ? z.enum(capabilities.audience as [string, ...string[]])
                : z.never(),
            roleIds: capabilities.audience ? idList : z.never(),
            reply: capabilities.reply
                ? z.enum(capabilities.reply as [string, ...string[]])
                : z.never(),
            channelIds: idList,
        })
        .partial()
}

/** A partial change of the command settings, keyed by command name. */
export const commandSettingsPatchSchema = z
    .strictObject({
        help: patchEntry("help"),
        stats: patchEntry("stats"),
        player: patchEntry("player"),
        link: patchEntry("link"),
        notice: patchEntry("notice"),
        "server-status": patchEntry("server-status"),
    })
    .partial()
export type CommandSettingsPatch = z.infer<typeof commandSettingsPatchSchema>

/** The settings after a validated patch; `/stats`'s switch is returned apart. */
export function applyCommandSettingsPatch(
    current: ResolvedCommandSettings,
    patch: CommandSettingsPatch
): ResolvedCommandSettings {
    const next = structuredClone(current)
    for (const command of CONFIGURABLE_COMMANDS) {
        const change = patch[command] as
            Partial<CommandSettingsEntry> | undefined
        if (!change) continue
        next[command] = { ...next[command], ...change }
    }
    // Normalise through the stored shape so impossible values drop out.
    return resolveCommandSettings(
        storeCommandSettings(next),
        next.stats.enabled
    )
}

/** Whether two resolved settings differ (the save bar counts commands). */
export function changedCommands(
    left: ResolvedCommandSettings,
    right: ResolvedCommandSettings
): ConfigurableCommand[] {
    return CONFIGURABLE_COMMANDS.filter(
        (command) =>
            JSON.stringify(left[command]) !== JSON.stringify(right[command])
    )
}
