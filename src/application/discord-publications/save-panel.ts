import {
    MAX_PANELS_PER_GUILD,
    PANEL_REFRESH_SECONDS,
    type PanelContent,
    type PanelGame,
    type PanelKind,
    type PanelSaveInput,
} from "@/domain/discord-publications/settings"
import type { PanelPresentationInput } from "@/domain/discord-publications/panel-presentation"
import type { LeaguePanelOptions } from "@/domain/wardogs-league/panels"

/**
 * "Uložit" in the panel editor (P2): validates one panel against the
 * workspace (its servers, ticket categories, competitions and the other
 * panels) and stores it. A new panel stays "Neodesláno" until "Odeslat do
 * kanálu" (or `send`); saving a sent panel edits its message in place.
 */
export type SavedPanelSummary = {
    id: string
    kind: PanelKind
    channelId: string
    connectionId: string | null
    gameId: string
    draft: boolean
    removing: boolean
    /** A message of this panel has reached Discord at least once. */
    sent: boolean
    revision: number
}

export type PanelRowWrite = {
    kind: PanelKind
    gameId: string
    channelId: string
    connectionId?: string
    connectionIds?: string[]
    title?: string
    description?: string
    showPlayers: boolean
    showLeaders: boolean
    reportCategoryId?: string
    artwork: boolean
    refreshSeconds: number
    content: PanelContent
    presentation?: PanelPresentationInput
    league?: LeaguePanelOptions
    calendarCategories?: string[]
    competitionId?: string
    enabled: true
    draft: boolean
    savedAt: number
    savedBy: string
    requestedAt?: number
    requestKind?: "publish" | "refresh"
    revision: number
}

export type PanelSaveStore = {
    panels(guildId: string): Promise<SavedPanelSummary[]>
    connections(
        guildId: string
    ): Promise<Array<{ id: string; gameId: PanelGame; provider: string }>>
    /** Ticket category IDs usable for reports; null without a private ticket destination. */
    reportCategories(guildId: string): Promise<string[] | null>
    competition(
        competitionId: string
    ): Promise<{ id: string; gameId: PanelGame } | null>
    /** Writes the row; the banner is resolved from the verified asset. */
    write(input: {
        guildId: string
        id: string | null
        row: PanelRowWrite
    }): Promise<{ id: string } | { error: "asset_unavailable" }>
}

export const PANEL_SAVE_ERRORS = [
    "not_found",
    "conflict",
    "kind_locked",
    "source_not_found",
    "game_mismatch",
    "report_destination_missing",
    "report_provider",
    "duplicate_channel",
    "results_exists",
    "league_exists",
    "calendar_exists",
    "competition_not_found",
    "panel_limit",
    "asset_unavailable",
    "removing",
] as const
export type PanelSaveError = (typeof PANEL_SAVE_ERRORS)[number]

export type PanelSaveResult =
    | { status: "saved"; id: string; revision: number; sent: boolean }
    | { status: "invalid"; reason: PanelSaveError }

const REPORT_PROVIDERS = ["hll_crcon", "wardogs_warcon"]

export async function savePanel(
    store: PanelSaveStore,
    input: {
        guildId: string
        /** Absent for a new panel. */
        panelId: string | null
        settings: PanelSaveInput
        /** "Odeslat do kanálu" together with saving. */
        send: boolean
        /** The revision the editor loaded; a newer one is a conflict. */
        expectedRevision: number | null
        actorId: string
        now: number
    }
): Promise<PanelSaveResult> {
    const settings = input.settings
    const [panels, connections] = await Promise.all([
        store.panels(input.guildId),
        store.connections(input.guildId),
    ])
    const existing = input.panelId
        ? (panels.find((panel) => panel.id === input.panelId) ?? null)
        : null
    const invalid = (reason: PanelSaveError): PanelSaveResult => ({
        status: "invalid",
        reason,
    })
    if (input.panelId && !existing) return invalid("not_found")
    if (existing?.removing) return invalid("removing")
    if (
        existing &&
        input.expectedRevision !== null &&
        existing.revision !== input.expectedRevision
    )
        return invalid("conflict")
    // P2-05: a sent panel keeps its type; another type is a new panel.
    if (existing && existing.sent && existing.kind !== settings.kind)
        return invalid("kind_locked")
    if (!existing && panels.length >= MAX_PANELS_PER_GUILD)
        return invalid("panel_limit")

    const others = panels.filter(
        (panel) => panel.id !== existing?.id && !panel.removing
    )
    const connectionOf = (id: string) =>
        connections.find((connection) => connection.id === id) ?? null
    let gameId: string
    switch (settings.kind) {
        case "server": {
            const connection = connectionOf(settings.connectionId!)
            if (!connection) return invalid("source_not_found")
            gameId = connection.gameId
            if (
                others.some(
                    (panel) =>
                        panel.kind === "server" &&
                        panel.connectionId === connection.id &&
                        panel.channelId === settings.channelId
                )
            )
                return invalid("duplicate_channel")
            if (settings.reportCategoryId) {
                if (!REPORT_PROVIDERS.includes(connection.provider))
                    return invalid("report_provider")
                const categories = await store.reportCategories(input.guildId)
                if (!categories?.includes(settings.reportCategoryId))
                    return invalid("report_destination_missing")
            }
            break
        }
        case "servers": {
            const found = settings.connectionIds!.map(connectionOf)
            if (found.some((connection) => !connection))
                return invalid("source_not_found")
            const games = new Set(found.map((connection) => connection!.gameId))
            gameId = games.size === 1 ? [...games][0]! : "mixed"
            break
        }
        case "results":
            gameId = settings.gameId!
            // P6-34, P6-B09: a second panel of one game would post every result twice.
            if (
                others.some(
                    (panel) =>
                        panel.kind === "results" && panel.gameId === gameId
                )
            )
                return invalid("results_exists")
            break
        case "league":
            gameId = "wardogs"
            if (others.some((panel) => panel.kind === "league"))
                return invalid("league_exists")
            break
        case "calendar":
            gameId = "any"
            if (others.some((panel) => panel.kind === "calendar"))
                return invalid("calendar_exists")
            break
        case "competition": {
            const competition = await store.competition(settings.competitionId!)
            if (!competition) return invalid("competition_not_found")
            gameId = competition.gameId
            break
        }
    }

    const draft = input.send ? false : (existing?.draft ?? true)
    const requestedAt =
        input.send || (existing && !existing.draft) ? input.now : undefined
    const row: PanelRowWrite = {
        kind: settings.kind,
        gameId,
        channelId: settings.channelId,
        ...(settings.connectionId && settings.kind === "server"
            ? { connectionId: settings.connectionId }
            : {}),
        ...(settings.kind === "servers"
            ? { connectionIds: settings.connectionIds }
            : {}),
        ...(settings.title ? { title: settings.title } : {}),
        ...(settings.description ? { description: settings.description } : {}),
        showPlayers: settings.showPlayers,
        showLeaders: settings.showLeaders,
        ...(settings.reportCategoryId && settings.kind === "server"
            ? { reportCategoryId: settings.reportCategoryId }
            : {}),
        artwork: settings.artwork,
        refreshSeconds: PANEL_REFRESH_SECONDS,
        content: settings.content,
        ...(settings.presentation
            ? { presentation: settings.presentation }
            : {}),
        ...(settings.kind === "league" && settings.league
            ? { league: settings.league }
            : {}),
        ...(settings.kind === "calendar" && settings.calendarCategories
            ? { calendarCategories: settings.calendarCategories }
            : {}),
        ...(settings.kind === "competition"
            ? { competitionId: settings.competitionId }
            : {}),
        enabled: true,
        draft,
        savedAt: input.now,
        savedBy: input.actorId,
        ...(requestedAt !== undefined
            ? {
                  requestedAt,
                  requestKind: input.send
                      ? ("publish" as const)
                      : ("refresh" as const),
              }
            : {}),
        revision: Math.max(input.now, (existing?.revision ?? 0) + 1),
    }
    const written = await store.write({
        guildId: input.guildId,
        id: existing?.id ?? null,
        row,
    })
    if ("error" in written) return invalid(written.error)
    return {
        status: "saved",
        id: written.id,
        revision: row.revision,
        sent: !draft,
    }
}
