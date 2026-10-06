/**
 * The "Panely" group of "Zprávy a panely" (board N1-28..36, N1-45a,
 * N1-B08): every panel the bot keeps in a channel, read from the same
 * overview as "Panely v Discordu" (`GET /api/servers/{serverId}/discord-panels`,
 * P1) and grouped by its rules (`panel-list.ts`). One row per panel with its
 * real state chip, its switch and its editor link; the WD League panel is
 * one row for both of its messages. The panels themselves are edited on
 * "Panely v Discordu"; this page only lists them and pauses or resumes a
 * panel with its switch. Pure, so the rules are tested without the page.
 */

import {
    PANEL_LIST_GROUPS,
    panelListGroup,
    type PanelListGroup,
} from "@/domain/discord-publications/panel-list"
import {
    channelLabel,
    fill,
    joinWords,
    panelErrorText,
} from "@/components/app/discord-panels/panel-copy"
import type {
    PanelOverviewItem,
    PanelOverviewResponse,
} from "@/components/app/discord-panels/panels-api"
import type { PanelDeliveryState } from "@/domain/discord-publications/panel-delivery"
import { PANEL_REFRESH_SECONDS } from "@/domain/discord-publications/settings"
import { isGameId, type GameId } from "@/domain/games/game"
import type { Dictionary } from "@/i18n/dictionaries"

/** A row's chip; a published panel has none (N1-29). */
export type PanelRowChip = Exclude<PanelDeliveryState, "published">

export type MessagesPanelRow = {
    key: string
    group: PanelListGroup
    /** The panel behind the row; null for the seed control and the old calendar channel. */
    panelId: string | null
    title: string
    /** "HLL" or "Wardogs" beside the title; none for clan-wide rows and results. */
    game: GameId | null
    chip: PanelRowChip | null
    detail: string
    /** Where the messages are; several for seed controls in different channels. */
    channelIds: string[]
    /** On while the panel runs; off while it is paused. */
    enabled: boolean
    /** An unsent panel is sent from "Panely v Discordu"; the seed is set on its own page. */
    toggleable: boolean
    switchLabel: string
    /** "Upravit": the panel's editor, the seed page or a new calendar panel. */
    href: string
}

export type MessagesPanelInput = {
    overview: PanelOverviewResponse
    dictionary: Dictionary
    channels: ReadonlyArray<{ id: string; name: string }>
    /** Event category names for the calendar row ("Zápas a Liga"). */
    categories: ReadonlyArray<{ id: string; label: string }>
    /** Competition names for competition rows. */
    competitions: ReadonlyArray<{ id: string; name: string }>
    /** The seed plan switch behind "Ovládání serveru"; null without a plan. */
    seed: { configured: boolean; enabled: boolean } | null
    /**
     * The calendar channel saved before panels existed (N1-47); listed while
     * the clan has no calendar panel.
     */
    calendarSetting: { channelId: string; posted: boolean } | null
    hrefs: { panels: string; seed: string }
}

/** The most urgent state of several messages: Chyba before Čeká na bota before the rest. */
export function worstPanelState(
    states: readonly PanelDeliveryState[]
): PanelDeliveryState {
    const order: PanelDeliveryState[] = [
        "error",
        "waiting",
        "unsent",
        "paused",
        "published",
    ]
    return order.find((state) => states.includes(state)) ?? "published"
}

const chipOf = (state: PanelDeliveryState): PanelRowChip | null =>
    state === "published" ? null : state

/** Every panel of the clan in the board's order (N1-29..36). */
export function messagesPanelRows(
    input: MessagesPanelInput
): MessagesPanelRow[] {
    const { overview, dictionary } = input
    const t = dictionary.settingsHub.messagesPage.panels
    const unknownChannel = dictionary.discordPanelsPage.list.meta.unknownChannel
    const source = (connectionId: string | null | undefined) =>
        overview.sources.find((entry) => entry.connectionId === connectionId)
    const serverName = (connectionId: string | null | undefined) =>
        source(connectionId)?.name ??
        dictionary.discordPanelsPage.list.titles.unknownServer
    const gameOf = (value: string | null | undefined): GameId | null =>
        value && isGameId(value) ? value : null
    const short = (game: GameId) =>
        game === "hell_let_loose"
            ? "HLL"
            : game === "wardogs"
              ? "Wardogs"
              : "HLL: Vietnam"
    /** The board's short, formal panel-level sentence, without its full stop (N1-31). */
    const errorDetail = (panel: PanelOverviewItem) =>
        panel.error
            ? panelErrorText(panel.error, {
                  channel: channelLabel(
                      panel.channelId,
                      input.channels,
                      unknownChannel
                  ),
                  dictionary,
              }).title.replace(/\.$/, "")
            : t.errorFallback
    /** "· pozastavil Hráč 01" where the overview knows who (N1-36). */
    const pausedBy = (panel: PanelOverviewItem) => {
        const name = panel.pausedBy ? overview.people[panel.pausedBy] : null
        return panel.state === "paused" && name
            ? ` · ${fill(t.pausedBy, { name })}`
            : ""
    }
    const editor = (panelId: string) =>
        `${input.hrefs.panels}/${encodeURIComponent(panelId)}`
    const panelRow = (
        panel: PanelOverviewItem,
        state: PanelDeliveryState,
        row: Pick<MessagesPanelRow, "title" | "game" | "detail"> & {
            switchLabel?: string
        }
    ): MessagesPanelRow => ({
        key: `panel:${panel.id}`,
        group: panelListGroup(panel.kind),
        panelId: panel.id,
        title: row.title,
        game: row.game,
        chip: chipOf(state),
        detail:
            state === "error"
                ? errorDetail(panel)
                : row.detail + pausedBy(panel),
        channelIds: [panel.channelId],
        enabled: state !== "paused",
        toggleable: state !== "unsent",
        switchLabel:
            row.switchLabel ?? fill(t.switchLabel, { name: row.title }),
        href: editor(panel.id),
    })

    const rows: MessagesPanelRow[] = []
    for (const panel of overview.panels) {
        switch (panel.kind) {
            case "server": {
                const content = panel.settings.content
                const hasPassword = overview.servers.some(
                    (server) =>
                        server.connectionId === panel.connectionId &&
                        server.hasPassword
                )
                const buttons = [
                    ...(content.joinButton ? [t.buttonNames.join] : []),
                    ...(panel.settings.showPlayers
                        ? [t.buttonNames.players]
                        : []),
                    ...(panel.settings.reportCategoryId
                        ? [t.buttonNames.report]
                        : []),
                ]
                const title = panel.title ?? serverName(panel.connectionId)
                rows.push(
                    panelRow(panel, panel.state, {
                        title,
                        game: gameOf(source(panel.connectionId)?.gameId),
                        // The password shows only in a private channel (N1-30).
                        detail:
                            panel.channelPrivate &&
                            content.password &&
                            hasPassword
                                ? t.privateDetail
                                : [
                                      fill(t.liveDetail, {
                                          seconds: PANEL_REFRESH_SECONDS,
                                      }),
                                      ...(buttons.length
                                          ? [
                                                fill(t.liveButtons, {
                                                    buttons: joinWords(
                                                        buttons,
                                                        t.and
                                                    ),
                                                }),
                                            ]
                                          : []),
                                  ].join(" · "),
                    })
                )
                break
            }
            case "servers": {
                const names = panel.connectionIds.map(
                    (id) => serverName(id).split(" · ")[0]!
                )
                rows.push(
                    panelRow(panel, panel.state, {
                        title: panel.title ?? t.combinedTitle,
                        game: null,
                        detail: fill(t.combinedDetail, {
                            servers: joinWords(names, t.and),
                        }),
                    })
                )
                break
            }
            case "results": {
                const game = gameOf(panel.gameId) ?? "hell_let_loose"
                rows.push(
                    panelRow(panel, panel.state, {
                        title:
                            panel.title ??
                            fill(t.resultsTitle, { game: short(game) }),
                        game: null,
                        detail: t.resultsDetail,
                    })
                )
                break
            }
            case "league": {
                // Both messages in one row: the most urgent of their states.
                const state = panel.parts?.length
                    ? worstPanelState(panel.parts.map((part) => part.state))
                    : panel.state
                rows.push(
                    panelRow(panel, state, {
                        title: panel.title ?? t.leagueTitle,
                        game: "wardogs",
                        detail: t.leagueDetail,
                        switchLabel: t.leagueSwitch,
                    })
                )
                break
            }
            case "calendar": {
                const names = (panel.settings.calendarCategories ?? []).map(
                    (id) =>
                        input.categories.find((category) => category.id === id)
                            ?.label ?? id
                )
                rows.push(
                    panelRow(panel, panel.state, {
                        title: panel.title ?? t.calendarTitle,
                        game: null,
                        detail: fill(t.calendarDetail, {
                            categories: names.length
                                ? joinWords(names, t.and)
                                : t.calendarAll,
                        }),
                        switchLabel: t.calendarSwitch,
                    })
                )
                break
            }
            case "competition": {
                const name = input.competitions.find(
                    (competition) =>
                        competition.id === panel.settings.competitionId
                )?.name
                rows.push(
                    panelRow(panel, panel.state, {
                        title: panel.title ?? name ?? t.competitionTitle,
                        game: gameOf(panel.gameId),
                        detail: name
                            ? fill(t.competitionDetail, { name })
                            : t.competitionDetailAny,
                    })
                )
                break
            }
        }
    }

    // "Ovládání serveru": one message per server (resolution 1), one row.
    if (overview.controls.length || input.seed?.configured) {
        const state = overview.controls.length
            ? worstPanelState(overview.controls.map((control) => control.state))
            : input.seed?.enabled
              ? "unsent"
              : "published"
        rows.push({
            key: "control",
            group: "control",
            panelId: null,
            title: t.controlTitle,
            game: null,
            chip: chipOf(state),
            detail: t.controlDetail,
            channelIds: [
                ...new Set(
                    overview.controls.map((control) => control.channelId)
                ),
            ],
            enabled: Boolean(input.seed?.enabled),
            toggleable: false,
            switchLabel: t.controlSwitch,
            href: input.hrefs.seed,
        })
    }

    const setting = input.calendarSetting
    if (setting && !overview.panels.some((panel) => panel.kind === "calendar"))
        rows.push({
            key: "calendar-setting",
            group: "calendar",
            panelId: null,
            title: t.calendarTitle,
            game: null,
            chip: setting.posted ? null : "waiting",
            detail: fill(t.calendarDetail, { categories: t.calendarAll }),
            channelIds: [setting.channelId],
            enabled: true,
            toggleable: false,
            switchLabel: t.calendarSwitch,
            href: `${input.hrefs.panels}/new?type=calendar`,
        })

    const order = (group: PanelListGroup) => PANEL_LIST_GROUPS.indexOf(group)
    return rows
        .map((row, index) => ({ row, index }))
        .sort(
            (a, b) =>
                order(a.row.group) - order(b.row.group) || a.index - b.index
        )
        .map(({ row }) => row)
}

/**
 * The live action of a panel switch: off is "Pozastavit" (the message stays
 * and is not refreshed), on is "Spustit". It goes to
 * `POST /api/servers/{serverId}/discord-panels/{panelId}/actions`.
 */
export function panelToggleAction(enabled: boolean): "pause" | "resume" {
    return enabled ? "resume" : "pause"
}
