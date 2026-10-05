import { z } from "zod"

/** Discord IDs (snowflakes) are 17–20 digit strings. */
const snowflake = z
    .string()
    .trim()
    .regex(/^\d{17,20}$/)

/**
 * Body of `POST /api/superadmin/platform-settings`. An empty status channel
 * clears it; the bot then posts no platform status message.
 */
export const platformSettingsInputSchema = z.strictObject({
    workspaceGuildId: snowflake,
    statusChannelId: z.union([snowflake, z.literal("")]).optional(),
})

export type PlatformSettingsInput = z.infer<typeof platformSettingsInputSchema>

/** Query of `GET /api/superadmin/platform-settings/channels`. */
export const platformChannelsQuerySchema = z.strictObject({
    guildId: snowflake,
})
