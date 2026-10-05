import { z } from "zod"

import { panelStyleSchema, type PanelStyle } from "./panel-graphics"

/** Faction keys the bot can label: Hell Let Loose sides and the Wardogs factions. */
export const PANEL_FACTIONS = [
    "allies",
    "axis",
    "valkyra",
    "manticore",
    "lonestar",
] as const
export type PanelFaction = (typeof PANEL_FACTIONS)[number]
export const PANEL_FACTION_GAMES = {
    hell_let_loose: ["allies", "axis"],
    wardogs: ["valkyra", "manticore", "lonestar"],
} as const satisfies Record<string, readonly PanelFaction[]>
export type PanelFactionGame = keyof typeof PANEL_FACTION_GAMES
export function isPanelFactionGame(
    value: string | null | undefined
): value is PanelFactionGame {
    return (
        typeof value === "string" &&
        Object.prototype.hasOwnProperty.call(PANEL_FACTION_GAMES, value)
    )
}
/** Rendered when neither an override nor an installed application emoji exists. */
export const NEUTRAL_FACTION_MARKER = "◈"
/**
 * What a faction shows without an override: Wardogs factions use the installed
 * application emoji, else the neutral marker; HLL CRCON team labels show none.
 */
export function defaultFactionEmoji(faction: PanelFaction): string | null {
    return (PANEL_FACTION_GAMES.wardogs as readonly string[]).includes(faction)
        ? NEUTRAL_FACTION_MARKER
        : null
}

/** Semantic faction match; provider labels such as Alpha/Bravo stay unknown. */
export function panelFactionOf(
    label: string | null | undefined
): PanelFaction | null {
    const key = label?.trim().toLowerCase()
    return key && (PANEL_FACTIONS as readonly string[]).includes(key)
        ? (key as PanelFaction)
        : null
}

export const PANEL_ACCENT_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/
/**
 * One Unicode emoji: a regional-indicator flag pair, or a pictograph with an
 * optional skin tone, optional variation selector and at most three ZWJ joins.
 */
const UNICODE_EMOJI =
    /^(?:\p{Regional_Indicator}{2}|\p{Extended_Pictographic}\p{Emoji_Modifier}?\uFE0F?(?:\u200D\p{Extended_Pictographic}\p{Emoji_Modifier}?\uFE0F?){0,3})$/u
/** Custom Discord emoji reference, static or animated. */
const CUSTOM_EMOJI = /^<a?:[A-Za-z0-9_]{2,32}:\d{17,20}>$/
export const PANEL_FACTION_EMOJI_MAX_LENGTH = 64
export function isPanelFactionEmoji(value: string): boolean {
    return (
        value.length <= PANEL_FACTION_EMOJI_MAX_LENGTH &&
        (CUSTOM_EMOJI.test(value) || UNICODE_EMOJI.test(value))
    )
}
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
export const DEFAULT_PANEL_LAYOUT: PanelLayout = {
    showMap: true,
    showScoreboard: true,
    showPlayerCount: true,
    compact: false,
}
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

export type ResolvedPanelPresentation = {
    layout: PanelLayout
    accentColor: string | null
    bannerAssetId: string | null
    bannerUrl: string | null
    factionEmoji: PanelFactionEmoji
}
export type PanelPresentationCarrier = {
    presentation?: Partial<PanelPresentation> | null
}
/** Fully defaulted appearance; a legacy record without presentation renders as before. */
export function resolvePanelPresentation(
    settings: PanelPresentationCarrier | null | undefined
): ResolvedPanelPresentation {
    const value = settings?.presentation
    return {
        layout: {
            showMap: value?.layout?.showMap ?? DEFAULT_PANEL_LAYOUT.showMap,
            showScoreboard:
                value?.layout?.showScoreboard ??
                DEFAULT_PANEL_LAYOUT.showScoreboard,
            showPlayerCount:
                value?.layout?.showPlayerCount ??
                DEFAULT_PANEL_LAYOUT.showPlayerCount,
            compact: value?.layout?.compact ?? DEFAULT_PANEL_LAYOUT.compact,
        },
        accentColor: value?.accentColor ?? null,
        bannerAssetId: value?.bannerAssetId ?? null,
        bannerUrl: value?.bannerUrl ?? null,
        factionEmoji: { ...value?.factionEmoji },
    }
}
/** Override first, then the runtime default (such as an application emoji), else null. */
export function factionEmojiFor(
    presentation: Pick<ResolvedPanelPresentation, "factionEmoji">,
    faction: PanelFaction,
    defaults: PanelFactionEmoji = {}
): string | null {
    return presentation.factionEmoji[faction] ?? defaults[faction] ?? null
}
/** Complete icon map for rendering; factions without any emoji are omitted. */
export function panelFactionIcons(
    presentation: Pick<ResolvedPanelPresentation, "factionEmoji">,
    defaults: PanelFactionEmoji = {}
): PanelFactionEmoji {
    const icons: PanelFactionEmoji = {}
    for (const faction of PANEL_FACTIONS) {
        const emoji = factionEmojiFor(presentation, faction, defaults)
        if (emoji) icons[faction] = emoji
    }
    return icons
}
/** Banner for the main image: only an HTTPS URL Discord can fetch, else null. */
export function panelBannerImage(
    presentation: Pick<ResolvedPanelPresentation, "bannerUrl">
): string | null {
    const url = presentation.bannerUrl
    return url && /^https:\/\/[^\s]+$/.test(url) ? url : null
}
/** Dashboard input cleanup: trims each value and drops empty or unknown factions. */
export function cleanPanelFactionEmoji(
    values: Partial<Record<string, string>>
): PanelFactionEmoji {
    const clean: PanelFactionEmoji = {}
    for (const faction of PANEL_FACTIONS) {
        const value = values[faction]?.trim()
        if (value) clean[faction] = value
    }
    return clean
}
/** Discord integer color; a missing or malformed accent keeps the caller's fallback. */
export function panelAccentColor(
    presentation: Pick<ResolvedPanelPresentation, "accentColor">,
    fallback: number
): number {
    const hex = presentation.accentColor
    return hex && PANEL_ACCENT_COLOR_PATTERN.test(hex)
        ? Number.parseInt(hex.slice(1), 16)
        : fallback
}
/** Editable appearance state in the dashboard; text fields hold raw user input. */
export type PanelPresentationDraft = {
    layout: PanelLayout
    accentColor: string | null
    bannerAssetId: string | null
    factionEmoji: Partial<Record<string, string>>
    style?: PanelStyle | null
}
export function isPanelAccentColorDraft(value: string | null): boolean {
    const trimmed = value?.trim() ?? ""
    return trimmed === "" || PANEL_ACCENT_COLOR_PATTERN.test(trimmed)
}
export function isPanelFactionEmojiDraft(value: string | undefined): boolean {
    const trimmed = value?.trim() ?? ""
    return trimmed === "" || isPanelFactionEmoji(trimmed)
}
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
