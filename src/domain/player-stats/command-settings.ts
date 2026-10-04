import { z } from "zod"

/** Games the `/stats` command serves; its `game` option maps onto these IDs. */
export const STATS_COMMAND_GAMES = ["hell_let_loose", "wardogs"] as const
export type StatsCommandGame = (typeof STATS_COMMAND_GAMES)[number]

export const statsCommandSettingsSchema = z.strictObject({
    enabled: z.boolean(),
    games: z.strictObject({
        hell_let_loose: z.boolean(),
        wardogs: z.boolean(),
    }),
    defaultShareChannelId: z
        .string()
        .regex(/^\d{17,20}$/)
        .optional(),
})
export type StatsCommandSettings = z.infer<typeof statsCommandSettingsSchema>

/** Workspaces without stored settings keep the command available for both games. */
export const DEFAULT_STATS_COMMAND_SETTINGS: StatsCommandSettings = {
    enabled: true,
    games: { hell_let_loose: true, wardogs: true },
}

const commandGame = { hll: "hell_let_loose", wardogs: "wardogs" } as const
export type StatsCommandOption = keyof typeof commandGame

export function statsCommandAccess(
    settings: StatsCommandSettings | undefined,
    game: StatsCommandOption
): "allowed" | "disabled" | "game_disabled" {
    const current = settings ?? DEFAULT_STATS_COMMAND_SETTINGS
    if (!current.enabled) return "disabled"
    return current.games[commandGame[game]] ? "allowed" : "game_disabled"
}

/** An explicit `channel` option wins; otherwise the configured default room, if any. */
export function resolveStatsShareChannel(
    settings: StatsCommandSettings | undefined,
    explicitChannelId: string | undefined
) {
    return explicitChannelId ?? settings?.defaultShareChannelId
}
