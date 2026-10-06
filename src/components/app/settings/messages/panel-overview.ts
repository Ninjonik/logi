/**
 * The "Panely" overview of "Zprávy a panely" (board N1-28..36, N1-B08):
 * every panel the bot keeps in a channel with its live status, read from
 * the panel, seed and calendar settings. The panels themselves are edited
 * on "Panely v Discordu"; this page only lists them and pauses or resumes
 * a panel with its switch. Pure, so the status rules are tested without
 * the page.
 */

import { z } from "zod"

import { isGameId, type GameId } from "@/domain/games/game"

/** A saved panel as `GET …/discord-public-panels` lists it (extra fields ignored). */
export const savedPanelSchema = z
    .object({
        _id: z.string(),
        kind: z.string(),
        connectionId: z.string(),
        channelId: z.string(),
        enabled: z.boolean(),
        /** "Pozastaveno" (W1); rows saved before it read `enabled`. */
        paused: z.boolean().optional(),
        /** "Neodesláno": saved but not sent to Discord yet. */
        draft: z.boolean().optional(),
        refreshSeconds: z.number().optional(),
        /** A private-channel panel that shows the server password (W1). */
        showPassword: z.boolean().optional(),
        publications: z
            .array(
                z
                    .object({
                        messageId: z.string().nullable().optional(),
                        error: z.string().nullable().optional(),
                    })
                    .passthrough()
            )
            .default([]),
    })
    .passthrough()

export type SavedPanel = z.infer<typeof savedPanelSchema>

export const panelListSchema = z.object({
    panels: z.array(z.unknown()).default([]),
})

/** The saved panels of a list response; broken entries are left out. */
export function parseSavedPanels(body: unknown): SavedPanel[] {
    const parsed = panelListSchema.safeParse(body)
    if (!parsed.success) return []
    return parsed.data.panels.flatMap((panel) => {
        const one = savedPanelSchema.safeParse(panel)
        return one.success ? [one.data] : []
    })
}

export type PanelStatus = "error" | "unsent" | "paused"

/** Whether a panel is paused, as `isPanelPaused` decides it for the bot. */
export function panelPaused(panel: {
    enabled: boolean
    paused?: boolean
}): boolean {
    return panel.paused ?? !panel.enabled
}

/**
 * The chip of a panel (N1-B08): "Chyba" after a failed delivery,
 * "Neodesláno" while not sent or never posted, "Pozastaveno" when paused.
 */
export function panelStatus(panel: {
    enabled: boolean
    paused?: boolean
    draft?: boolean
    publications: ReadonlyArray<{
        messageId?: string | null
        error?: string | null
    }>
}): { status?: PanelStatus; error?: string } {
    if (panel.draft) return { status: "unsent" }
    if (panelPaused(panel)) return { status: "paused" }
    const failed = panel.publications.find((item) => item.error?.trim())
    if (failed) return { status: "error", error: failed.error!.trim() }
    if (!panel.publications.some((item) => item.messageId))
        return { status: "unsent" }
    return {}
}

export type PanelOverviewItem = {
    key: string
    kind: "live" | "combined" | "control" | "results" | "league" | "calendar"
    name?: string
    game?: GameId
    status?: PanelStatus
    error?: string
    channelId?: string
    refreshSeconds?: number
    showPassword?: boolean
    /** The switch: on while the panel runs, off while it is paused. */
    enabled?: boolean
    toggleable: boolean
    /** The saved public panel behind the row. */
    panelId?: string
}

export type PanelSource = { name: string; gameId?: string }

const ORDER: Record<PanelOverviewItem["kind"], number> = {
    live: 0,
    combined: 1,
    control: 2,
    results: 3,
    league: 4,
    calendar: 5,
}

/** Every panel of the clan in the board's order. */
export function panelOverviewItems(input: {
    panels: readonly SavedPanel[]
    sources: ReadonlyMap<string, PanelSource>
    seed?: {
        configured: boolean
        enabled: boolean
        controlChannelId: string | null
    } | null
    calendar: {
        channelId?: string
        messageId?: string
    }
    wardogs: boolean
}): PanelOverviewItem[] {
    const items: PanelOverviewItem[] = input.panels.map((panel) => {
        const source = input.sources.get(panel.connectionId)
        const game =
            source?.gameId && isGameId(source.gameId)
                ? source.gameId
                : undefined
        const status = panelStatus(panel)
        const kind: PanelOverviewItem["kind"] =
            panel.kind === "results"
                ? "results"
                : panel.kind === "combined"
                  ? "combined"
                  : panel.kind === "league"
                    ? "league"
                    : "live"
        return {
            key: `panel:${panel._id}`,
            kind,
            name: source?.name,
            game,
            ...status,
            channelId: panel.channelId,
            refreshSeconds: panel.refreshSeconds,
            showPassword: panel.showPassword,
            enabled: !panel.draft && !panelPaused(panel),
            // A panel not sent yet is sent from "Panely v Discordu".
            toggleable: !panel.draft,
            panelId: panel._id,
        }
    })
    if (input.seed?.configured)
        items.push({
            key: "control",
            kind: "control",
            channelId: input.seed.controlChannelId ?? undefined,
            enabled: input.seed.enabled,
            toggleable: false,
            ...(input.seed.enabled && !input.seed.controlChannelId
                ? { status: "unsent" as const }
                : {}),
        })
    if (input.wardogs && !items.some((item) => item.kind === "league"))
        items.push({ key: "league", kind: "league", toggleable: false })
    items.push({
        key: "calendar",
        kind: "calendar",
        channelId: input.calendar.channelId,
        enabled: Boolean(input.calendar.channelId),
        toggleable: false,
        ...(input.calendar.channelId && !input.calendar.messageId
            ? { status: "unsent" as const }
            : {}),
    })
    return items.sort((a, b) => ORDER[a.kind] - ORDER[b.kind])
}

/**
 * The live action of a panel switch: off is "Pozastavit" (the message stays
 * and is not refreshed), on is "Spustit". It goes to
 * `POST /api/servers/{serverId}/discord-panels/{panelId}/actions`.
 */
export function panelToggleAction(enabled: boolean): "pause" | "resume" {
    return enabled ? "resume" : "pause"
}
