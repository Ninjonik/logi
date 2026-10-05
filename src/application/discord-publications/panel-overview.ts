import {
    botHeartbeatState,
    panelDeliveryState,
    PANEL_DELIVERY_STATES,
    type BotHeartbeat,
    type BotHeartbeatState,
    type PanelAction,
    type PanelDeliveryState,
    type PanelError,
    type PanelStatusRecord,
    type PanelWarning,
} from "@/domain/discord-publications/panel-delivery"
import {
    isPanelPaused,
    normalizePanelKind,
    resolvePanelContent,
    type PanelContent,
    type PanelKind,
} from "@/domain/discord-publications/settings"
import type { PanelPresentation } from "@/domain/discord-publications/panel-presentation"
import { resolvePanelStyle } from "@/domain/discord-publications/panel-graphics"
import type { LeaguePanelOptions } from "@/domain/wardogs-league/panels"

/**
 * The read model of "Panely v Discordu" (P1, P2-03, P2-31..33): every panel
 * with its state chip, timing, last error and delivery timeline, the bot
 * heartbeat and the data sources. Never contains a password, a key or a
 * provider address.
 */
export type StoredPanel = {
    id: string
    kind: string
    gameId: string
    channelId: string
    connectionId?: string
    connectionIds?: string[]
    title?: string
    description?: string
    enabled: boolean
    paused?: boolean
    pausedAt?: number | null
    pausedBy?: string | null
    draft?: boolean
    removing?: boolean
    showPlayers: boolean
    showLeaders?: boolean
    reportCategoryId?: string
    artwork: boolean
    content?: Partial<PanelContent>
    presentation?: Partial<PanelPresentation> | null
    league?: LeaguePanelOptions
    calendarCategories?: string[]
    competitionId?: string
    savedAt?: number
    savedBy?: string
    requestedAt?: number
    requestKind?: PanelAction
    revision: number
    createdAt: number
}

export type StoredPublication = {
    key: string
    channelId: string | null
    messageId: string | null
    pending: boolean
    lastSuccessAt: number | null
    retryAt: number
    error: string | null
}

export type PanelOverviewItem = {
    id: string
    kind: PanelKind
    gameId: string
    channelId: string
    connectionId: string | null
    connectionIds: string[]
    title: string | null
    state: PanelDeliveryState
    paused: boolean
    pausedAt: number | null
    pausedBy: string | null
    revision: number
    /** The editor's view of the settings (`panelSaveSchema` shape). */
    settings: {
        kind: PanelKind
        channelId: string
        connectionId?: string
        connectionIds?: string[]
        gameId?: string
        title?: string
        description?: string
        showPlayers: boolean
        showLeaders: boolean
        reportCategoryId?: string
        artwork: boolean
        content: PanelContent
        presentation?: Partial<PanelPresentation>
        league?: LeaguePanelOptions
        calendarCategories?: string[]
        competitionId?: string
    }
    /** "Uloženo · Bot převzal · Odesláno · Poslední obnova" (P2-31). */
    timeline: {
        savedAt: number | null
        savedBy: string | null
        requestedAt: number | null
        claimedAt: number | null
        sentAt: number | null
        lastUpdateAt: number | null
        lastAttemptAt: number | null
        nextUpdateAt: number | null
        dataAt: number | null
    }
    error: PanelError | null
    /** A create Discord did not confirm; "Zkusit znovu" sends it again (P2-33). */
    uncertain: boolean
    warnings: PanelWarning[]
    /** The panel's first message, for "Otevřít zprávu" (P1-13). */
    message: { channelId: string; messageId: string } | null
    messages: number
    /** Every panel uses the clan's default style unless it sets its own. */
    style: "a" | "b" | "c"
}

export type PanelSourceHealth = {
    connectionId: string
    name: string | null
    gameId: string
    provider: string
    collecting: boolean
    lastDataAt: number | null
    freshness: "fresh" | "stale" | "unavailable"
    errorCategory: string | null
}

export type PanelServerInfo = {
    connectionId: string
    slug: string | null
    joinUrl: string | null
    address: string | null
    joinCode: string | null
    /** Whether an encrypted password is stored; the value never leaves Convex. */
    hasPassword: boolean
}

export type PanelOverview = {
    bot: BotHeartbeatState
    panels: PanelOverviewItem[]
    counts: Record<PanelDeliveryState, number>
    sources: PanelSourceHealth[]
    servers: PanelServerInfo[]
}

export function buildPanelOverview(input: {
    now: number
    heartbeat: (BotHeartbeat & { seenAt: number }) | null
    defaultStyle: "a" | "b" | "c"
    panels: Array<{
        panel: StoredPanel
        status: PanelStatusRecord | null
        publications: StoredPublication[]
    }>
    sources: PanelSourceHealth[]
    servers: PanelServerInfo[]
}): PanelOverview {
    const counts = Object.fromEntries(
        PANEL_DELIVERY_STATES.map((state) => [state, 0])
    ) as Record<PanelDeliveryState, number>
    const panels = input.panels.flatMap(({ panel, status, publications }) => {
        const kind = normalizePanelKind(panel.kind)
        if (!kind) return []
        const delivered = publications.filter(
            (publication) => publication.channelId && publication.messageId
        )
        const uncertain = publications.some(
            (publication) => publication.pending && publication.error !== null
        )
        const paused = isPanelPaused(panel)
        const state = panelDeliveryState({
            draft: Boolean(panel.draft),
            paused,
            removing: Boolean(panel.removing),
            requestedAt: panel.requestedAt ?? null,
            status,
            messages: delivered.length,
            uncertain,
        })
        counts[state]++
        const main =
            delivered.find(
                (publication) =>
                    publication.key === `panel:${panel.id}` ||
                    publication.key === "calendar"
            ) ??
            delivered[0] ??
            null
        const item: PanelOverviewItem = {
            id: panel.id,
            kind,
            gameId: panel.gameId,
            channelId: panel.channelId,
            connectionId: panel.connectionId ?? null,
            connectionIds: panel.connectionIds ?? [],
            title: panel.title ?? null,
            state,
            paused,
            pausedAt: panel.pausedAt ?? null,
            pausedBy: panel.pausedBy ?? null,
            revision: panel.revision,
            settings: {
                kind,
                channelId: panel.channelId,
                ...(panel.connectionId
                    ? { connectionId: panel.connectionId }
                    : {}),
                ...(panel.connectionIds
                    ? { connectionIds: panel.connectionIds }
                    : {}),
                ...(kind === "results" &&
                (panel.gameId === "hell_let_loose" ||
                    panel.gameId === "wardogs")
                    ? { gameId: panel.gameId }
                    : {}),
                ...(panel.title ? { title: panel.title } : {}),
                ...(panel.description
                    ? { description: panel.description }
                    : {}),
                showPlayers: panel.showPlayers,
                showLeaders: panel.showLeaders ?? false,
                ...(panel.reportCategoryId
                    ? { reportCategoryId: panel.reportCategoryId }
                    : {}),
                artwork: panel.artwork,
                content: resolvePanelContent(panel.content),
                ...(panel.presentation
                    ? { presentation: panel.presentation }
                    : {}),
                ...(panel.league ? { league: panel.league } : {}),
                ...(panel.calendarCategories
                    ? { calendarCategories: panel.calendarCategories }
                    : {}),
                ...(panel.competitionId
                    ? { competitionId: panel.competitionId }
                    : {}),
            },
            timeline: {
                savedAt: panel.savedAt ?? panel.createdAt,
                savedBy: panel.savedBy ?? null,
                requestedAt: panel.requestedAt ?? null,
                claimedAt: status?.claimedAt ?? null,
                sentAt:
                    status?.sentAt ??
                    (delivered.length
                        ? Math.min(
                              ...delivered.map(
                                  (publication) =>
                                      publication.lastSuccessAt ?? input.now
                              )
                          )
                        : null),
                lastUpdateAt:
                    status?.successAt ??
                    (delivered.length
                        ? Math.max(
                              ...delivered.map(
                                  (publication) =>
                                      publication.lastSuccessAt ?? 0
                              )
                          ) || null
                        : null),
                lastAttemptAt: status?.attemptAt ?? null,
                nextUpdateAt: status?.nextAt ?? null,
                dataAt: status?.dataAt ?? null,
            },
            error:
                status?.error ??
                (uncertain
                    ? { code: "delivery_uncertain", at: input.now }
                    : null),
            uncertain,
            warnings: status?.warnings ?? [],
            message: main
                ? { channelId: main.channelId!, messageId: main.messageId! }
                : null,
            messages: delivered.length,
            style: resolvePanelStyle(
                {
                    presentation: {
                        style: panel.presentation?.style ?? null,
                    },
                },
                input.defaultStyle
            ),
        }
        return [item]
    })
    return {
        bot: botHeartbeatState(input.heartbeat, input.now),
        panels,
        counts,
        sources: input.sources,
        servers: input.servers,
    }
}
