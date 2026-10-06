import {
    cleanPanelFactionEmoji,
    DEFAULT_PANEL_LAYOUT,
    isPanelAccentColorDraft,
    isPanelFactionEmoji,
    isPanelFactionEmojiDraft,
    PANEL_ACCENT_COLOR_PATTERN,
    PANEL_FACTION_EMOJI_MAX_LENGTH,
    PANEL_FACTIONS,
    type PanelFaction,
    type PanelPresentationDraft,
} from "./panel-presentation"
import { panelStyleSchema } from "./panel-graphics.schema"
import { z } from "zod"

export const panelFactionEmojiSchema = z
    .string()
    .max(PANEL_FACTION_EMOJI_MAX_LENGTH)
    .refine(
        isPanelFactionEmoji,
        "Use one Unicode emoji or a <:name:id> custom emoji."
    )

export const panelLayoutSchema = z.strictObject({
    /** Map name and map artwork; artwork additionally needs the `artwork` setting. */
    showMap: z.boolean().default(true),
    /** Faction/team score section of live panels. */
    showScoreboard: z.boolean().default(true),
    /** Connected players / capacity in the live panel header. */
    showPlayerCount: z.boolean().default(true),
    /** Condensed two-line header, inline scores and no section separators. */
    compact: z.boolean().default(false),
})
export type PanelLayout = z.infer<typeof panelLayoutSchema>
export const panelFactionEmojiMapSchema = z.partialRecord(
    z.enum(PANEL_FACTIONS),
    panelFactionEmojiSchema
)
export type PanelFactionEmoji = z.infer<typeof panelFactionEmojiMapSchema>

/** Client-supplied appearance. The banner URL is never part of the input. */
export const panelPresentationInputSchema = z.strictObject({
    layout: panelLayoutSchema.default(() => ({ ...DEFAULT_PANEL_LAYOUT })),
    accentColor: z
        .string()
        .regex(PANEL_ACCENT_COLOR_PATTERN)
        .nullable()
        .default(null),
    bannerAssetId: z.string().min(1).max(100).nullable().default(null),
    factionEmoji: panelFactionEmojiMapSchema.default(() => ({})),
    /**
     * Panel style A/B/C overriding the clan default (P2, P7-B01); null or
     * absent follows the clan default from "Grafika panelů".
     */
    style: panelStyleSchema.nullable().optional(),
})
export type PanelPresentationInput = z.infer<
    typeof panelPresentationInputSchema
>
/** Stored appearance: the server resolves `bannerUrl` from the verified asset. */
export const panelPresentationSchema = panelPresentationInputSchema.extend({
    bannerUrl: z.string().max(512).nullable().default(null),
})
export type PanelPresentation = z.infer<typeof panelPresentationSchema>

/**
 * Save input for the factions the panel can show, or null while a field is
 * invalid. Empty fields fall back to defaults; the banner URL is never sent.
 */
export function panelPresentationFromDraft(
    draft: PanelPresentationDraft,
    factions: readonly PanelFaction[]
): PanelPresentationInput | null {
    const visible: Partial<Record<string, string>> = {}
    for (const faction of factions)
        visible[faction] = draft.factionEmoji[faction]
    if (
        !isPanelAccentColorDraft(draft.accentColor) ||
        !factions.every((faction) =>
            isPanelFactionEmojiDraft(draft.factionEmoji[faction])
        )
    )
        return null
    const parsed = panelPresentationInputSchema.safeParse({
        layout: draft.layout,
        accentColor: draft.accentColor?.trim().toLowerCase() || null,
        bannerAssetId: draft.bannerAssetId,
        factionEmoji: cleanPanelFactionEmoji(visible),
        ...(draft.style !== undefined ? { style: draft.style } : {}),
    })
    return parsed.success ? parsed.data : null
}
