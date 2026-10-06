import {
    leagueRows,
    panelListGroup,
    panelRowActions,
    panelTimingParts,
    PANEL_LIST_GROUPS,
    type PanelListGroup,
    type PanelRowActions,
    type PanelRowSource,
    type PanelTimingPart,
} from "@/domain/discord-publications/panel-list"
import type {
    PanelDeliveryState,
    PanelError,
} from "@/domain/discord-publications/panel-delivery"
import { DEFAULT_LEAGUE_PANEL_OPTIONS } from "@/domain/wardogs-league/panels"
import type { PanelKind } from "@/domain/discord-publications/settings"
import type { Dictionary } from "@/i18n/dictionaries"

import {
    channelLabel,
    fill,
    joinWords,
    panelErrorText,
    plural,
} from "./panel-copy"
import type { PanelOverviewItem, PanelOverviewResponse } from "./panels-api"

/** One meta fact of a row: a game chip, a chip with server names, or text. */
export type RowMeta =
    | { kind: "game"; game: string; label: string }
    | { kind: "servers"; game: string; label: string; names: string }
    | { kind: "text"; text: string }
    | { kind: "channel"; text: string }

export type PanelRowModel = {
    key: string
    source: PanelRowSource
    group: PanelListGroup
    /** The panel; null for a seed control message. */
    panelId: string | null
    connectionId: string | null
    kind: PanelKind | null
    state: PanelDeliveryState
    title: string
    meta: RowMeta[]
    timing: PanelTimingPart[]
    /** "Otevřít zprávu" in Discord. */
    messageUrl: string | null
    error: { title: string; fix: string } | null
    actions: PanelRowActions
}

export type PanelRowContext = {
    dictionary: Dictionary
    locale: string
    guildId: string
    channels: ReadonlyArray<{ id: string; name: string }> | null
    now: number
    /** Event category names for the calendar row ("Zápas a Liga"). */
    categories: ReadonlyArray<{ id: string; label: string }>
    /** Competition names for competition rows. */
    competitions: ReadonlyArray<{ id: string; name: string }>
    /**
     * The calendar channel saved before panels existed (N1-47); listed while
     * the clan has no calendar panel.
     */
    calendarSetting?: {
        channelId: string
        message: { channelId: string; messageId: string } | null
    } | null
}

export function discordMessageUrl(
    guildId: string,
    message: { channelId: string; messageId: string } | null
) {
    return message
        ? `https://discord.com/channels/${guildId}/${message.channelId}/${message.messageId}`
        : null
}

const PROVIDERS = ["hll_crcon", "wardogs_warcon"] as const

/** Every row of the list in board order, grouped (P1-12..22). */
export function panelRows(
    overview: PanelOverviewResponse,
    context: PanelRowContext
): Array<{ group: PanelListGroup; rows: PanelRowModel[] }> {
    const text = context.dictionary.discordPanelsPage
    const list = text.list
    const source = (connectionId: string | null | undefined) =>
        overview.sources.find((entry) => entry.connectionId === connectionId)
    const serverName = (connectionId: string | null | undefined) =>
        source(connectionId)?.name ?? list.titles.unknownServer
    const gameLabel = (game: string) =>
        game === "wardogs" || game === "hell_let_loose"
            ? text.games[game]
            : game
    const channel = (channelId: string | null | undefined) => ({
        kind: "channel" as const,
        text: channelLabel(
            channelId,
            context.channels,
            list.meta.unknownChannel
        ).replace(/^#/, "# "),
    })
    const providerLabel = (provider: string | undefined) =>
        (PROVIDERS as readonly string[]).includes(provider ?? "")
            ? text.sources.providers[provider as (typeof PROVIDERS)[number]]
            : null

    const rows: PanelRowModel[] = []
    const timing = (
        panel: PanelOverviewItem,
        rowSource: PanelRowSource
    ): PanelTimingPart[] =>
        panelTimingParts({
            source: rowSource,
            kind: panel.kind,
            state: panel.state,
            now: context.now,
            savedAt: panel.timeline.savedAt,
            requestedAt: panel.timeline.requestedAt,
            lastUpdateAt: panel.timeline.lastUpdateAt,
            lastAttemptAt: panel.timeline.lastAttemptAt,
            nextUpdateAt: panel.timeline.nextUpdateAt,
            pausedAt: panel.pausedAt,
            pausedBy: panel.pausedBy
                ? (overview.people[panel.pausedBy] ?? null)
                : null,
            messages: panel.messages,
            hasMessage: Boolean(panel.message),
        })
    const errorText = (panel: PanelOverviewItem, error: PanelError) =>
        panelErrorText(error, {
            channel: channelLabel(
                panel.channelId,
                context.channels,
                list.meta.unknownChannel
            ),
            dictionary: context.dictionary,
        })
    const errorOf = (panel: PanelOverviewItem) =>
        panel.state === "error" && panel.error
            ? errorText(panel, panel.error)
            : null
    const base = (panel: PanelOverviewItem, rowSource: PanelRowSource) => ({
        key: `${panel.id}:${rowSource}`,
        source: rowSource,
        group: panelListGroup(panel.kind),
        panelId: panel.id,
        connectionId: panel.connectionId,
        kind: panel.kind,
        state: panel.state,
        timing: timing(panel, rowSource),
        messageUrl: discordMessageUrl(context.guildId, panel.message),
        error: errorOf(panel),
        actions: panelRowActions({
            source: rowSource,
            kind: panel.kind,
            state: panel.state,
        }),
    })
    /**
     * A WD League message (P1-20, P1-21): its own state, time, link and
     * error from its publication; the buttons still act on the panel.
     */
    const leagueBase = (
        panel: PanelOverviewItem,
        rowSource: "league-table" | "league-fixtures"
    ) => {
        const part = (panel.parts ?? []).find(
            (entry) =>
                entry.part ===
                (rowSource === "league-table" ? "standings" : "fixtures")
        )
        if (!part) return base(panel, rowSource)
        const own: PanelOverviewItem = {
            ...panel,
            state: part.state,
            message: part.message,
            timeline: { ...panel.timeline, lastUpdateAt: part.lastUpdateAt },
        }
        const error: PanelError | null =
            part.state !== "error"
                ? null
                : part.uncertain
                  ? { code: "delivery_uncertain", at: context.now }
                  : (panel.error ?? { code: "unknown", at: context.now })
        return {
            ...base(own, rowSource),
            error: error ? errorText(panel, error) : null,
        }
    }

    for (const panel of overview.panels) {
        switch (panel.kind) {
            case "server": {
                const health = source(panel.connectionId)
                const privacy =
                    panel.channelPrivate === null
                        ? null
                        : panel.channelPrivate
                          ? panel.settings.content.password &&
                            overview.servers.some(
                                (server) =>
                                    server.connectionId ===
                                        panel.connectionId && server.hasPassword
                            )
                              ? list.meta.privateWithPassword
                              : list.meta.privateChannel
                          : list.meta.publicChannel
                rows.push({
                    ...base(panel, "panel"),
                    title: panel.title ?? serverName(panel.connectionId),
                    meta: [
                        ...(health
                            ? [
                                  {
                                      kind: "game" as const,
                                      game: health.gameId,
                                      label: gameLabel(health.gameId),
                                  },
                              ]
                            : []),
                        ...(providerLabel(health?.provider)
                            ? [
                                  {
                                      kind: "text" as const,
                                      text: providerLabel(health?.provider)!,
                                  },
                              ]
                            : []),
                        channel(panel.channelId),
                        ...(privacy
                            ? [{ kind: "text" as const, text: privacy }]
                            : []),
                    ],
                })
                break
            }
            case "servers": {
                const byGame = new Map<string, string[]>()
                for (const id of panel.connectionIds) {
                    const game = source(id)?.gameId ?? "hell_let_loose"
                    byGame.set(game, [
                        ...(byGame.get(game) ?? []),
                        serverName(id),
                    ])
                }
                rows.push({
                    ...base(panel, "panel"),
                    title: panel.title ?? list.titles.combined,
                    meta: [
                        ...[...byGame].map(([game, names]) => ({
                            kind: "servers" as const,
                            game,
                            label: gameLabel(game),
                            names: names
                                .map((name) => name.split(" · ")[0]!)
                                .join(", "),
                        })),
                        channel(panel.channelId),
                    ],
                })
                break
            }
            case "results":
                rows.push({
                    ...base(panel, "panel"),
                    title:
                        panel.title ??
                        fill(list.titles.results, {
                            game: gameLabel(panel.gameId),
                        }),
                    meta: [
                        {
                            kind: "game",
                            game: panel.gameId,
                            label: gameLabel(panel.gameId),
                        },
                        { kind: "text", text: list.meta.results },
                        channel(panel.channelId),
                    ],
                })
                break
            case "league": {
                const options =
                    panel.settings.league ?? DEFAULT_LEAGUE_PANEL_OPTIONS
                for (const part of leagueRows(options)) {
                    const fixturesText = options.fixtures
                        ? plural(
                              options.recentResults
                                  ? list.meta.leagueFixtures
                                  : list.meta.leagueFixturesOnly,
                              options.fixtureCount,
                              context.locale
                          )
                        : list.meta.leagueRecentOnly
                    rows.push({
                        ...leagueBase(panel, part),
                        title:
                            part === "league-table"
                                ? list.titles.leagueTable
                                : list.titles.leagueFixtures,
                        meta: [
                            {
                                kind: "game",
                                game: "wardogs",
                                label: gameLabel("wardogs"),
                            },
                            {
                                kind: "text",
                                text:
                                    part === "league-table"
                                        ? list.meta.leagueTable
                                        : fixturesText,
                            },
                            channel(panel.channelId),
                        ],
                    })
                }
                break
            }
            case "calendar": {
                const names = (panel.settings.calendarCategories ?? []).map(
                    (id) =>
                        context.categories.find(
                            (category) => category.id === id
                        )?.label ?? id
                )
                rows.push({
                    ...base(panel, "panel"),
                    title: panel.title ?? list.titles.calendar,
                    meta: [
                        {
                            kind: "text",
                            text: names.length
                                ? fill(list.meta.calendarCategories, {
                                      categories: joinWords(
                                          names,
                                          list.meta.and
                                      ),
                                  })
                                : list.meta.calendarAll,
                        },
                        channel(panel.channelId),
                    ],
                })
                break
            }
            case "competition": {
                const name = context.competitions.find(
                    (competition) =>
                        competition.id === panel.settings.competitionId
                )?.name
                rows.push({
                    ...base(panel, "panel"),
                    title: panel.title ?? name ?? list.titles.competition,
                    meta: [
                        ...(panel.gameId === "wardogs" ||
                        panel.gameId === "hell_let_loose"
                            ? [
                                  {
                                      kind: "game" as const,
                                      game: panel.gameId,
                                      label: gameLabel(panel.gameId),
                                  },
                              ]
                            : []),
                        ...(name
                            ? [
                                  {
                                      kind: "text" as const,
                                      text: fill(list.meta.competition, {
                                          name,
                                      }),
                                  },
                              ]
                            : []),
                        channel(panel.channelId),
                    ],
                })
                break
            }
        }
    }

    const setting = context.calendarSetting
    if (setting && !overview.panels.some((panel) => panel.kind === "calendar"))
        rows.push({
            key: "calendar-setting",
            source: "calendar-setting",
            group: "calendar",
            panelId: null,
            connectionId: null,
            kind: "calendar",
            state: setting.message ? "published" : "waiting",
            title: list.titles.calendar,
            meta: [
                { kind: "text", text: list.meta.calendarAll },
                channel(setting.channelId),
            ],
            timing: panelTimingParts({
                source: "calendar-setting",
                kind: "calendar",
                state: setting.message ? "published" : "waiting",
                now: context.now,
                savedAt: null,
                requestedAt: null,
                lastUpdateAt: null,
                lastAttemptAt: null,
                nextUpdateAt: null,
                pausedAt: null,
                pausedBy: null,
                messages: setting.message ? 1 : 0,
                hasMessage: Boolean(setting.message),
            }),
            messageUrl: discordMessageUrl(context.guildId, setting.message),
            error: null,
            actions: panelRowActions({
                source: "calendar-setting",
                kind: "calendar",
                state: "published",
            }),
        })

    for (const control of overview.controls) {
        const health = source(control.connectionId)
        rows.push({
            key: `control:${control.connectionId}`,
            source: "control",
            group: "control",
            panelId: null,
            connectionId: control.connectionId,
            kind: null,
            state: control.state,
            title: list.titles.control,
            meta: [
                ...(health
                    ? [
                          {
                              kind: "servers" as const,
                              game: health.gameId,
                              label: gameLabel(health.gameId),
                              names: serverName(control.connectionId),
                          },
                      ]
                    : []),
                channel(control.channelId),
                { kind: "text", text: list.meta.control },
            ],
            timing: panelTimingParts({
                source: "control",
                kind: null,
                state: control.state,
                now: context.now,
                savedAt: null,
                requestedAt: null,
                lastUpdateAt: control.lastUpdateAt,
                lastAttemptAt: null,
                nextUpdateAt: null,
                pausedAt: null,
                pausedBy: null,
                messages: control.message ? 1 : 0,
                hasMessage: Boolean(control.message),
            }),
            messageUrl: discordMessageUrl(context.guildId, control.message),
            error: null,
            actions: panelRowActions({
                source: "control",
                kind: null,
                state: control.state,
            }),
        })
    }

    return PANEL_LIST_GROUPS.map((group) => ({
        group,
        rows: rows.filter((row) => row.group === group),
    })).filter((entry) => entry.rows.length > 0)
}
