import {
    PANEL_ERROR_CODES,
    PANEL_PERMISSIONS,
    PANEL_WARNINGS,
} from "./panel-delivery"
import { z } from "zod"

/**
 * Zod schemas of what the bot reports (`discordPanelBotWrites`); the pure
 * delivery rules stay in `panel-delivery.ts`, which the bot's panel reads
 * and the overview walk without Zod.
 */
export const panelErrorSchema = z.strictObject({
    code: z.enum(PANEL_ERROR_CODES),
    at: z.number().int().nonnegative(),
    /** Missing channel permissions, for `missing_permissions`. */
    permissions: z.array(z.enum(PANEL_PERMISSIONS)).max(5).optional(),
    /** The provider failure category, e.g. `timeout` or `rate_limited`. */
    category: z
        .string()
        .regex(/^[a-z_]{1,40}$/)
        .optional(),
})
export type PanelError = z.infer<typeof panelErrorSchema>

/** What the bot reports after every pass over a panel. */
export const panelAttemptSchema = z.strictObject({
    attemptAt: z.number().int().nonnegative(),
    ok: z.boolean(),
    error: panelErrorSchema.nullable(),
    /** When the bot will look at the panel again. */
    nextAt: z.number().int().nonnegative().nullable(),
    /** When the shown server data was read. */
    dataAt: z.number().int().nonnegative().nullable(),
    /** The admin request (`requestedAt`) this pass answered. */
    handledRequestAt: z.number().int().nonnegative().nullable(),
    warnings: z.array(z.enum(PANEL_WARNINGS)).max(PANEL_WARNINGS.length),
    /** Messages the panel owns in Discord after this pass. */
    messages: z.number().int().min(0).max(1000),
    /**
     * Whether `@everyone` cannot view the panel's channel, as the bot saw it
     * on this pass ("veřejný kanál" / "soukromý kanál", P1-13, P1-14).
     * Absent when the pass did not look at the channel.
     */
    channelPrivate: z.boolean().optional(),
})
export type PanelAttempt = z.infer<typeof panelAttemptSchema>

export const botHeartbeatSchema = z.strictObject({
    version: z.string().regex(/^[A-Za-z0-9._+-]{1,40}$/),
    protocol: z.number().int().min(1).max(1000),
    startedAt: z.number().int().nonnegative(),
})
export type BotHeartbeat = z.infer<typeof botHeartbeatSchema>
