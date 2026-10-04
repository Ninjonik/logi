import { z } from "zod"
export const publicPanelSettingsSchema = z.strictObject({
    kind: z.enum(["server", "scoreboard", "results"]),
    connectionId: z.string().min(1).max(100),
    channelId: z.string().regex(/^\d{17,20}$/),
    enabled: z.boolean(),
    showPlayers: z.boolean(),
    showLeaders: z.boolean().default(false),
    reportCategoryId: z.string().max(100).optional(),
    artwork: z.boolean(),
    refreshSeconds: z.union([z.literal(30), z.literal(60), z.literal(300)]),
})
export type PublicPanelSettings = z.infer<typeof publicPanelSettingsSchema>
