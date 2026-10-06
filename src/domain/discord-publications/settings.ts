import type {
    PanelContent,
    PublicPanelSettings,
    PublicPanelSettingsInput,
} from "./settings.schema"

// The Zod schemas of the editor input and the stored panel
// (`panelContentSchema`, `panelSaveSchema`, `publicPanelSettingsSchema`,
// `publicPanelSaveResultSchema`) live in `settings.schema.ts`, so the bot's
// read paths that only normalize kinds and content stay free of Zod and of
// the League panel schemas behind them.
export type {
    PanelContent,
    PanelSaveInput,
    PublicPanelSaveResult,
    PublicPanelSettings,
    PublicPanelSettingsInput,
} from "./settings.schema"

/**
 * Panel types of "Panely v Discordu" (P1-B08, P2-04): one live server, the
 * combined "Naše servery", one results panel per game, the two WD League
 * messages, the calendar and a competition table (L3-19..24).
 */
export const PANEL_KINDS = [
    "server",
    "servers",
    "results",
    "league",
    "calendar",
    "competition",
] as const
export type PanelKind = (typeof PANEL_KINDS)[number]
/** Kinds stored before L3-02: `scoreboard` renders exactly as `server`. */
export const STORED_PANEL_KINDS = [...PANEL_KINDS, "scoreboard"] as const
export type StoredPanelKind = (typeof STORED_PANEL_KINDS)[number]
/**
 * Live score and server status are one kind (L3-02): server status is the
 * live panel with the score switched off. Old `scoreboard` rows read as
 * `server`; unknown values are not panels.
 */
export function normalizePanelKind(kind: string): PanelKind | null {
    if (kind === "scoreboard") return "server"
    return (PANEL_KINDS as readonly string[]).includes(kind)
        ? (kind as PanelKind)
        : null
}
/** Kinds that read one or more game servers. */
export function isServerPanelKind(kind: PanelKind) {
    return kind === "server" || kind === "servers"
}
/**
 * Whether a panel reads a game server live: its own server, or any server of
 * "Naše servery" (P4-38). The bot's live reads are authorized by panel with
 * it, so a combined panel shows the same live data as the server's own panel.
 */
export function panelReadsConnection(
    panel: {
        kind: string
        connectionId?: string | null
        connectionIds?: readonly string[] | null
    },
    connectionId: string
): boolean {
    const kind = normalizePanelKind(panel.kind)
    if (kind === "server") return panel.connectionId === connectionId
    if (kind === "servers")
        return (panel.connectionIds ?? []).includes(connectionId)
    return false
}
/** Every live panel refreshes every 60 s (L3-B04, P4-B02, P1-B06). */
export const PANEL_REFRESH_SECONDS = 60
export const PANEL_GAMES = ["hell_let_loose", "wardogs"] as const
export type PanelGame = (typeof PANEL_GAMES)[number]
/** Panels per workspace; a panel may own several messages. */
export const MAX_PANELS_PER_GUILD = 20
/** Servers in one "Naše servery" panel (two button rows of five). */
export const MAX_COMBINED_SERVERS = 10
export const DEFAULT_PANEL_CONTENT: PanelContent = {
    nextMap: true,
    queue: true,
    address: true,
    joinCode: true,
    joinButton: true,
    password: false,
    seedProgress: true,
    footerTiming: true,
}
/** Stored content with defaults; rows saved before the redesign have none. */
export function resolvePanelContent(
    value: Partial<PanelContent> | null | undefined
): PanelContent {
    return {
        ...DEFAULT_PANEL_CONTENT,
        // Rows saved before "Ukázat join kód" had one switch for both.
        joinCode: value?.joinCode ?? value?.address ?? true,
        ...value,
    }
}
/** Paused is the real flag; rows saved before it read their old switch (P5-B06). */
export function isPanelPaused(row: {
    paused?: boolean | null
    enabled: boolean
}): boolean {
    return row.paused ?? !row.enabled
}

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
            ...(presentation.style !== undefined
                ? { style: presentation.style }
                : {}),
        },
    }
}
