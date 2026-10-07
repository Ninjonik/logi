import {
    errorCard,
    escapeMarkdownText,
    type MessageBlock,
    type MessageButton,
    type MessageView,
} from "../discord-messages/message-view"
import type { PlayerListCopy } from "./panel-copy"
import type { LivePlayer } from "./live-panel"
import type { PanelGame } from "./settings"

/**
 * "Zobrazit hráče" (P4-40..43, L3-39..41, L3-B08): the current round's
 * players as a private reply, eight per page, sorted by kills and split by
 * side (HLL) or faction (Wardogs): kills / deaths, or kills / money now.
 */
export const PLAYERS_PER_PAGE = 8

/** One side of the list: its key, its words and its sign. */
export type PlayerListSide = { key: string; label: string; sign: string }

const key = (value: string | null | undefined) =>
    value?.trim().toLowerCase() ?? ""

/**
 * How many rows each side gets on one page: eight split evenly, the first
 * sides taking the remainder (HLL 4 + 4, Wardogs 3 + 3 + 2).
 */
export function sideQuotas(sides: number, perPage = PLAYERS_PER_PAGE) {
    if (sides <= 0) return []
    const base = Math.floor(perPage / sides)
    const extra = perPage % sides
    return Array.from({ length: sides }, (_, index) =>
        Math.max(1, base + (index < extra ? 1 : 0))
    )
}

export type PlayerListPage = {
    page: number
    pages: number
    groups: Array<{
        side: PlayerListSide
        total: number
        players: LivePlayer[]
    }>
}

/** Groups by side in the given order (players without a known side last), kills first. */
export function playerListPage(
    roster: readonly LivePlayer[],
    sides: readonly PlayerListSide[],
    requestedPage: number,
    other: PlayerListSide
): PlayerListPage {
    const known = new Set(sides.map((side) => key(side.key)))
    const byKills = (a: LivePlayer, b: LivePlayer) =>
        (b.kills ?? -1) - (a.kills ?? -1) || a.name.localeCompare(b.name, "en")
    const groups = [
        ...sides.map((side) => ({
            side,
            players: roster
                .filter((player) => key(player.side) === key(side.key))
                .sort(byKills),
        })),
        {
            side: other,
            players: roster
                .filter((player) => !known.has(key(player.side)))
                .sort(byKills),
        },
    ].filter((group) => group.players.length > 0)
    const quotas = sideQuotas(groups.length)
    const pages = Math.max(
        1,
        ...groups.map((group, index) =>
            Math.ceil(group.players.length / quotas[index]!)
        )
    )
    const page = Math.min(Math.max(0, Math.floor(requestedPage)), pages - 1)
    return {
        page,
        pages,
        groups: groups.map((group, index) => ({
            side: group.side,
            total: group.players.length,
            players: group.players.slice(
                page * quotas[index]!,
                (page + 1) * quotas[index]!
            ),
        })),
    }
}

export type PlayerListInput = {
    copy: PlayerListCopy
    locale: string
    game: PanelGame
    /** The panel's title, e.g. "Vlci #1". */
    serverTitle: string
    mapName: string | null
    playerCount: number
    roster: readonly LivePlayer[]
    rosterAt: number | null
    sides: readonly PlayerListSide[]
    otherSide: PlayerListSide
    page: number
    /** Custom IDs: `id(page, action)`; the page button is never pressed. */
    id: (page: number, action: "previous" | "next" | "page") => string
}

export function playerListView(input: PlayerListInput): MessageView {
    const { copy } = input
    const page = playerListPage(
        input.roster,
        input.sides,
        input.page,
        input.otherSide
    )
    const number = (value: number) =>
        new Intl.NumberFormat(input.locale, {
            maximumFractionDigits: 0,
        }).format(value)
    const metric = (player: LivePlayer) =>
        input.game === "wardogs"
            ? `${number(player.kills ?? 0)} / ${number(player.cash ?? 0)}`
            : `${player.kills === null ? "—" : number(player.kills)} / ${player.deaths === null ? "—" : number(player.deaths)}`
    const observed = input.rosterAt
        ? `<t:${Math.floor(input.rosterAt / 1000)}:R>`
        : "—"
    const blocks: MessageBlock[] = [
        {
            kind: "meta",
            lines: [
                {
                    text:
                        input.game === "wardogs"
                            ? copy.metaWardogs(observed)
                            : copy.metaHll(observed),
                },
            ],
        },
    ]
    if (!page.groups.length) blocks.push({ kind: "text", markdown: copy.empty })
    for (const group of page.groups) {
        const sign = group.side.sign ? `${group.side.sign} ` : ""
        blocks.push({
            kind: "text",
            markdown: [
                `${sign}**${escapeMarkdownText(copy.sideHeader(group.side.label, number(group.total)))}**`,
                ...group.players.map(
                    (player) =>
                        `${sign}**${escapeMarkdownText(Array.from(player.name).slice(0, 40).join(""))}** · ${metric(player)}`
                ),
            ].join("\n"),
        })
    }
    blocks.push({ kind: "separator", divider: true, spacing: "small" })
    const buttons: MessageButton[] = [
        {
            kind: "action",
            id: input.id(Math.max(0, page.page - 1), "previous"),
            label: copy.previous,
            style: "secondary",
            disabled: page.page <= 0,
        },
        {
            kind: "action",
            id: input.id(page.page, "page"),
            label: copy.pageButton(String(page.page + 1), String(page.pages)),
            style: "secondary",
            disabled: true,
        },
        {
            kind: "action",
            id: input.id(Math.min(page.pages - 1, page.page + 1), "next"),
            label: copy.next,
            style: "secondary",
            disabled: page.page >= page.pages - 1,
        },
    ]
    blocks.push({ kind: "buttons", buttons })
    return {
        accent: "clan",
        ephemeral: true,
        header: {
            label: `${copy.label} · ${input.serverTitle}`,
            title: input.mapName
                ? copy.title(input.mapName, number(input.playerCount))
                : copy.titleNoMap(number(input.playerCount)),
        },
        blocks,
        footer: {
            kind: "managed",
            notes: [copy.sortedNote],
            page: { page: page.page + 1, pages: page.pages },
        },
    }
}

/** The list is unavailable right now (no fresh current-round players). */
export function playerListUnavailableView(copy: PlayerListCopy): MessageView {
    return errorCard({
        title: copy.unavailableTitle,
        body: copy.unavailableBody,
    })
}

/** An old panel: open the current one (L3-41). */
export function playerListOutdatedView(copy: PlayerListCopy): MessageView {
    return errorCard({ title: copy.outdatedTitle, body: copy.outdatedBody })
}
