import {
    botHeartbeatState,
    panelDeliveryState,
    panelMessageState,
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
import {
    leaguePanelKey,
    LEAGUE_PANEL_ORDER,
    type LeaguePanelOptions,
    type LeaguePanelPart,
} from "@/domain/wardogs-league/panels"
import type { PanelPresentation } from "@/domain/discord-publications/panel-presentation"
import { resolvePanelStyle } from "@/domain/discord-publications/panel-graphics"
import type { PanelEmojiKey } from "@/domain/discord-publications/panel-emblems"

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

/**
 * One message of a panel that owns several (the WD League "tabulka" and
 * "nejbližší zápasy", P1-20, P1-21), with its own delivery from its managed
 * publication. Actions still apply to the whole panel.
 */
export type PanelMessageItem = {
    part: LeaguePanelPart
    state: PanelDeliveryState
    lastUpdateAt: number | null
    /** A create of this message Discord did not confirm (P2-33). */
    uncertain: boolean
    message: { channelId: string; messageId: string } | null
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
    /**
     * The most recent failure even after a later success, for "Poslední
     * chyba … Další pokus … prošel" (P2-32); null when it never failed.
     */
    lastError: PanelError | null
    /** The first success after `lastError`; null while the panel still fails. */
    recoveredAt: number | null
    /** A message of this panel reached Discord at least once: its type is locked (P2-05). */
    sent: boolean
    /** `@everyone` cannot view the channel, as the bot last saw it; null before it looked. */
    channelPrivate: boolean | null
    /** A create Discord did not confirm; "Zkusit znovu" sends it again (P2-33). */
    uncertain: boolean
    warnings: PanelWarning[]
    /** The panel's first message, for "Otevřít zprávu" (P1-13). */
    message: { channelId: string; messageId: string } | null
    messages: number
    /** Each message of a WD League panel with its own state; empty for other kinds. */
    parts: PanelMessageItem[]
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

/**
 * The seed control message of one server ("Ovládání serveru", P1-18,
 * P5-26..29): it lives in the server's private admin channel and is drawn
 * by the seed worker, so it is listed with the panels.
 */
export type StoredControlMessage = {
    connectionId: string
    /** The plan's control channel; null when none is set. */
    channelId: string | null
    message: {
        channelId: string | null
        messageId: string | null
        revision: number
        deliveredRevision: number
        lastSuccessAt: number | null
        error: string | null
        pending: boolean
    } | null
}

export type PanelControlItem = {
    connectionId: string
    channelId: string
    state: PanelDeliveryState
    lastUpdateAt: number | null
    /** The control message failed its last delivery. */
    failed: boolean
    message: { channelId: string; messageId: string } | null
}

export type PanelOverview = {
    bot: BotHeartbeatState
    panels: PanelOverviewItem[]
    counts: Record<PanelDeliveryState, number>
    sources: PanelSourceHealth[]
    servers: PanelServerInfo[]
    /** "Ovládání serveru" messages, one per server with a control channel. */
    controls: PanelControlItem[]
    /** Display names of the admins who saved or paused a panel ("Hráč 01"). */
    people: Record<string, string>
    /**
     * Discord markup of the panel signs the bot installed as application
     * emoji, by key, so the editor preview shows them as Discord does
     * (P2-B09). Empty until a bot reports them.
     */
    emoji: Partial<Record<PanelEmojiKey, string>>
}

/** The state chip of a seed control message, from its managed-message row. */
export function controlMessageState(
    message: StoredControlMessage["message"]
): PanelDeliveryState {
    if (!message) return "waiting"
    if (message.error && message.revision > message.deliveredRevision)
        return "error"
    if (message.pending && message.error) return "error"
    if (message.revision > message.deliveredRevision || !message.messageId)
        return "waiting"
    return "published"
}

/** The editor's view of a stored panel (`panelSaveSchema` shape), also used by `/api/v1`. */
export function panelEditorSettings(
    panel: StoredPanel,
    kind: PanelKind
): PanelOverviewItem["settings"] {
    return {
        kind,
        channelId: panel.channelId,
        ...(panel.connectionId ? { connectionId: panel.connectionId } : {}),
        ...(panel.connectionIds ? { connectionIds: panel.connectionIds } : {}),
        ...(kind === "results" &&
        (panel.gameId === "hell_let_loose" || panel.gameId === "wardogs")
            ? { gameId: panel.gameId }
            : {}),
        ...(panel.title ? { title: panel.title } : {}),
        ...(panel.description ? { description: panel.description } : {}),
        showPlayers: panel.showPlayers,
        showLeaders: panel.showLeaders ?? false,
        ...(panel.reportCategoryId
            ? { reportCategoryId: panel.reportCategoryId }
            : {}),
        artwork: panel.artwork,
        content: resolvePanelContent(panel.content),
        ...(panel.presentation ? { presentation: panel.presentation } : {}),
        ...(panel.league ? { league: panel.league } : {}),
        ...(panel.calendarCategories
            ? { calendarCategories: panel.calendarCategories }
            : {}),
        ...(panel.competitionId ? { competitionId: panel.competitionId } : {}),
    }
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
    controls?: StoredControlMessage[]
    people?: Record<string, string>
    emoji?: Partial<Record<PanelEmojiKey, string>>
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
            settings: panelEditorSettings(panel, kind),
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
            lastError: status?.error ?? status?.lastError ?? null,
            recoveredAt: status?.error ? null : (status?.recoveredAt ?? null),
            sent:
                Boolean(status?.sentAt) ||
                delivered.length > 0 ||
                // Panels saved by the old form were posted on save.
                panel.draft === undefined,
            channelPrivate: status?.channelPrivate ?? null,
            uncertain,
            warnings: status?.warnings ?? [],
            message: main
                ? { channelId: main.channelId!, messageId: main.messageId! }
                : null,
            messages: delivered.length,
            parts:
                kind === "league"
                    ? LEAGUE_PANEL_ORDER.map((part): PanelMessageItem => {
                          const own =
                              publications.find(
                                  (publication) =>
                                      publication.key ===
                                      leaguePanelKey(panel.id, part)
                              ) ?? null
                          return {
                              part,
                              state: panelMessageState({
                                  panel: state,
                                  requestedAt: panel.requestedAt ?? null,
                                  errorAt: status?.error?.at ?? null,
                                  publication: own,
                              }),
                              lastUpdateAt: own?.lastSuccessAt ?? null,
                              uncertain: Boolean(own?.pending && own.error),
                              message:
                                  own?.channelId && own.messageId
                                      ? {
                                            channelId: own.channelId,
                                            messageId: own.messageId,
                                        }
                                      : null,
                          }
                      })
                    : [],
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
    const controls = (input.controls ?? []).flatMap(
        (control): PanelControlItem[] => {
            if (!control.channelId) return []
            const message = control.message
            return [
                {
                    connectionId: control.connectionId,
                    channelId: control.channelId,
                    state: controlMessageState(message),
                    lastUpdateAt: message?.lastSuccessAt ?? null,
                    failed: Boolean(message?.error),
                    message:
                        message?.channelId && message.messageId
                            ? {
                                  channelId: message.channelId,
                                  messageId: message.messageId,
                              }
                            : null,
                },
            ]
        }
    )
    return {
        bot: botHeartbeatState(input.heartbeat, input.now),
        panels,
        counts,
        sources: input.sources,
        servers: input.servers,
        controls,
        people: input.people ?? {},
        emoji: input.emoji ?? {},
    }
}
