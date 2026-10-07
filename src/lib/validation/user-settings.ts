import { z } from "zod"

/**
 * One save from the user settings page. Every field is optional: an omitted
 * field keeps its stored value, so a card can save on its own without sending
 * (and overwriting) the others. An empty `platformIds` clears them and an empty
 * `defaultWorkspaceId` returns to automatic.
 */
export const userSettingsPatchSchema = z.strictObject({
    avatar: z
        .string()
        .trim()
        .min(1, "Avatar is required.")
        .max(2048)
        .optional(),
    platformIds: z.string().max(1000).optional(),
    matchRecapNotificationsEnabled: z.boolean().optional(),
    defaultWorkspaceId: z
        .string()
        .trim()
        .regex(/^\d{0,32}$/, "Choose a workspace you can access.")
        .optional(),
})

export type UserSettingsPatch = z.infer<typeof userSettingsPatchSchema>
