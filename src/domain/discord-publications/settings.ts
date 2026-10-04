import {
    panelPresentationSchema,
    type PanelPresentationInput,
} from "./panel-presentation"
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
    /** Absent on legacy records; the bot then renders exactly as before. */
    presentation: panelPresentationSchema.optional(),
})
export type PublicPanelSettings = z.infer<typeof publicPanelSettingsSchema>
export type PublicPanelSettingsInput = Omit<
    PublicPanelSettings,
    "presentation"
> & { presentation?: PanelPresentationInput }
/** Persistence input: the server resolves the banner URL from the verified asset. */
export function publicPanelSettingsInput(
    settings: PublicPanelSettings
): PublicPanelSettingsInput {
    const { presentation, ...rest } = settings
    if (!presentation) return rest
    return {
        ...rest,
        presentation: {
            layout: presentation.layout,
            accentColor: presentation.accentColor,
            bannerAssetId: presentation.bannerAssetId,
            factionEmoji: presentation.factionEmoji,
        },
    }
}
/** Result of the configure mutation; `asset_unavailable` names a banner the workspace cannot attach. */
export const publicPanelSaveResultSchema = z.union([
    z.object({ ok: z.literal(true), id: z.string() }),
    z.object({ error: z.literal("asset_unavailable") }),
])
export type PublicPanelSaveResult = z.infer<typeof publicPanelSaveResultSchema>
