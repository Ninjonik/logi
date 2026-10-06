import {
    panelPresentationInputSchema,
    panelPresentationSchema,
    type PanelPresentationInput,
} from "./panel-presentation"
import { leaguePanelOptionsSchema } from "../wardogs-league/panels"
import { z } from "zod"

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
/** Every live panel refreshes every 60 s (L3-B04, P4-B02, P1-B06). */
export const PANEL_REFRESH_SECONDS = 60
export const PANEL_GAMES = ["hell_let_loose", "wardogs"] as const
export type PanelGame = (typeof PANEL_GAMES)[number]
/** Panels per workspace; a panel may own several messages. */
export const MAX_PANELS_PER_GUILD = 20
/** Servers in one "Naše servery" panel (two button rows of five). */
export const MAX_COMBINED_SERVERS = 10
const snowflake = z.string().regex(/^\d{17,20}$/)
const connectionRef = z.string().min(1).max(100)

/**
 * What a live server panel shows besides the presentation layout (P2-11..20,
 * P2-26, P2-38..41). Everything is on by default except the password, which
 * additionally needs a channel `@everyone` cannot view (P4-B06).
 */
export const panelContentSchema = z.strictObject({
    nextMap: z.boolean().default(true),
    queue: z.boolean().default(true),
    /** "Ukázat IP:port" (HLL servers). */
    address: z.boolean().default(true),
    /** "Ukázat join kód" (Wardogs servers, P2-39). */
    joinCode: z.boolean().default(true),
    /** "Tlačítko Připojit se (přes Logi)". */
    joinButton: z.boolean().default(true),
    password: z.boolean().default(false),
    seedProgress: z.boolean().default(true),
    /** "Ukázat v patičce zprávy" the update time and refresh interval. */
    footerTiming: z.boolean().default(true),
})
export type PanelContent = z.infer<typeof panelContentSchema>
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
const panelText = (max: number) =>
    z
        .string()
        .max(max * 2)
        .transform((value) => value.replace(/\s+/g, " ").trim())
        .pipe(z.string().max(max))

/**
 * One panel as the editor saves it (P2). The kind decides which fields
 * apply: a live server needs its connection, "Naše servery" its ordered
 * servers, results and competitions their game or competition. The bot never
 * reads secrets from here; the server password is stored separately and
 * encrypted (`server-password.ts`).
 */
export const panelSaveSchema = z
    .strictObject({
        kind: z.enum(PANEL_KINDS),
        channelId: snowflake,
        connectionId: connectionRef.optional(),
        connectionIds: z
            .array(connectionRef)
            .min(1)
            .max(MAX_COMBINED_SERVERS)
            .optional(),
        gameId: z.enum(PANEL_GAMES).optional(),
        /** "Název": empty uses the server name (P2-21). */
        title: panelText(80).optional(),
        /** "Popis": a short admin sentence under the title (P2-22, L3-43). */
        description: panelText(300).optional(),
        showPlayers: z.boolean().default(true),
        showLeaders: z.boolean().default(true),
        reportCategoryId: z.string().min(1).max(100).optional(),
        artwork: z.boolean().default(true),
        content: panelContentSchema.default(() => ({
            ...DEFAULT_PANEL_CONTENT,
        })),
        presentation: panelPresentationInputSchema.optional(),
        league: leaguePanelOptionsSchema.optional(),
        /** Event category IDs the calendar shows; empty or absent shows all (L3-B07). */
        calendarCategories: z
            .array(z.string().trim().min(1).max(100))
            .max(50)
            .optional(),
        competitionId: connectionRef.optional(),
    })
    .superRefine((value, ctx) => {
        const issue = (path: string, message: string) =>
            ctx.addIssue({ code: "custom", path: [path], message })
        if (value.kind === "server" && !value.connectionId)
            issue("connectionId", "A live server panel needs its server.")
        if (value.kind === "servers") {
            if (!value.connectionIds?.length)
                issue("connectionIds", "Choose at least one server.")
            else if (
                new Set(value.connectionIds).size !== value.connectionIds.length
            )
                issue("connectionIds", "A server is listed twice.")
        }
        if (value.kind === "results" && !value.gameId)
            issue("gameId", "A results panel belongs to one game.")
        if (value.kind === "competition" && !value.competitionId)
            issue("competitionId", "Choose the competition.")
        if (value.reportCategoryId && value.kind !== "server")
            issue("reportCategoryId", "Only a live server can report players.")
    })
export type PanelSaveInput = z.infer<typeof panelSaveSchema>

/** Paused is the real flag; rows saved before it read their old switch (P5-B06). */
export function isPanelPaused(row: {
    paused?: boolean | null
    enabled: boolean
}): boolean {
    return row.paused ?? !row.enabled
}

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
            ...(presentation.style !== undefined
                ? { style: presentation.style }
                : {}),
        },
    }
}
/** Result of the configure mutation; `asset_unavailable` names a banner the workspace cannot attach. */
export const publicPanelSaveResultSchema = z.union([
    z.object({ ok: z.literal(true), id: z.string() }),
    z.object({ error: z.literal("asset_unavailable") }),
])
export type PublicPanelSaveResult = z.infer<typeof publicPanelSaveResultSchema>
