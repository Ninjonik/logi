import {
    DISCORD_MESSAGE_LIMITS,
    escapeMarkdownText,
    panelFrame,
    type MessageButton,
    type MessageField,
    type MessageMedia,
    type MessageView,
} from "../discord-messages/message-view"
import {
    hllSideSign,
    liveGaugeLine,
    liveServerState,
    liveStateChip,
    wardogsSign,
    type LiveServerFacts,
    type PanelEmojiMarkup,
} from "./live-panel"
import {
    combinedPanelJoinRows,
    minutesLeft,
    type PanelStyle,
} from "./panel-graphics"
import { panelImageCopy } from "./panel-image-copy"
import { PANEL_REFRESH_SECONDS } from "./settings"
import type { LivePanelCopy } from "./panel-copy"

/**
 * "Naše servery" (P4-37..39, P4-B08, P7-19/20, P7-B09): one optional message
 * listing several servers, each still keeping its own panel. Public data
 * only: no password, no player names and no Logi match. A section holds one
 * accessory, so the join buttons stand in a bottom row, five per row.
 *
 * Every style shows the board's row: the state chip, the signs with the
 * score and the map, then the player gauge. Style B puts the banner on top,
 * style C leaves out the map pictures (P7-19).
 */
export type CombinedServer = {
    connectionId: string
    title: string
    facts: LiveServerFacts
    paused: boolean
    seed: { liveFrom: number } | null
    liveFrom: number
    joinUrl: string | null
    /** The server can be joined: an address (HLL) or a join code (Wardogs). */
    joinable: boolean
    /** The current map on the right of the row (P7-B09); null without one. */
    thumbnail: MessageMedia | null
    /** "IP:port" of an HLL server when "Ukázat IP:port" is on (P2-43). */
    address?: string | null
    /** The Wardogs join code when "Ukázat join kód" is on (P2-45). */
    joinCode?: string | null
    /** The 10-segment seed bar of a running seed (P2-44), e.g. "🟩🟩⬛…". */
    seedBar?: string | null
}

export type CombinedPanelInput = {
    copy: LivePanelCopy
    language: string
    clanName: string
    title: string | null
    description: string | null
    accentColor: string | null
    footerTiming: boolean
    /**
     * What a row shows (P2-38 "Skóre", "Další mapa", "Fronta"); absent shows
     * the queue only, as panels saved before these switches.
     */
    show?: { score: boolean; nextMap: boolean; queue: boolean }
    servers: CombinedServer[]
    now: number
    /** The style B banner on top of the card (P7-19); null in A and C. */
    banner: MessageMedia | null
    /** The panel's style; absent draws style A. */
    style?: PanelStyle
    /** Installed application emoji for the signs and the gauge. */
    emoji?: PanelEmojiMarkup
}

/** "★ **3 : 2** ✚" or "◈ **23** ◈ **12** ◈ **7**": the signs with the score (P7-19). */
function rowSigns(
    server: CombinedServer,
    input: CombinedPanelInput,
    scored: boolean
) {
    const { facts } = server
    const emoji = input.emoji ?? {}
    if (facts.game === "hell_let_loose") {
        const hll = facts.hll
        if (!scored || !hll || hll.allies === null || hll.axis === null)
            return null
        return `${hllSideSign("allies", hll.nations, emoji)} **${hll.allies} : ${hll.axis}** ${hllSideSign("axis", hll.nations, emoji)}`
    }
    const factions = facts.wardogs?.factions ?? []
    if (!factions.length) return null
    return factions
        .map((faction) =>
            scored
                ? `${wardogsSign(faction.key, emoji)} **${faction.points}**`
                : wardogsSign(faction.key, emoji)
        )
        .join(" ")
}

function rowText(server: CombinedServer, input: CombinedPanelInput) {
    const { facts } = server
    const { copy } = input
    const locale = panelImageCopy(input.language).locale
    const number = (value: number) =>
        new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(
            value
        )
    const parts: string[] = [copy.game[facts.game]]
    if (facts.freshness === "unavailable") {
        parts.push(copy.serverNotResponding)
        return parts.join(" · ")
    }
    const show = input.show ?? { score: false, nextMap: false, queue: true }
    const live = (facts.players ?? 0) > 0 && !server.seed && !server.paused
    const signs = rowSigns(server, input, show.score && live)
    if (signs) parts.push(signs)
    if (facts.map) parts.push(escapeMarkdownText(facts.map.name))
    const gauge = server.seed
        ? null
        : liveGaugeLine(facts, {
              queue: show.queue,
              emoji: input.emoji ?? {},
              language: input.language,
          })
    // The gauge carries the players and the queue; without one, the text does.
    if (
        !gauge &&
        !server.seed &&
        facts.players !== null &&
        facts.capacity !== null
    )
        parts.push(
            copy.playersShort(number(facts.players), number(facts.capacity))
        )
    if (server.seed)
        parts.push(
            copy.seedingProgress(
                number(facts.players ?? 0),
                number(server.seed.liveFrom)
            )
        )
    else if (!gauge && facts.queue && show.queue)
        parts.push(copy.queue(number(facts.queue)))
    // P2-43: "Spojenci 3 : 2 Osa" stays readable next to the signs.
    if (
        show.score &&
        live &&
        facts.hll &&
        facts.hll.allies !== null &&
        facts.hll.axis !== null &&
        !signs
    )
        parts.push(
            `${copy.allies} ${number(facts.hll.allies)} : ${number(facts.hll.axis)} ${copy.axis}`
        )
    // The round time belongs to the score (P2-43); without it the row is the
    // board's "Foy · 78 / 100 · fronta 3" (P4-38, L3-43).
    const minutes = minutesLeft(facts.timeLeftSeconds)
    if (show.score && minutes !== null && live)
        parts.push(copy.timeLeft(String(minutes)))
    if (facts.freshness === "stale" && facts.dataAt)
        parts.push(copy.lastData(`<t:${Math.floor(facts.dataAt / 1000)}:R>`))
    if (show.nextMap && facts.nextMap)
        parts.push(copy.nextMapInline(escapeMarkdownText(facts.nextMap.name)))
    const lines = [parts.join(" · ")]
    // P2-44: a running seed shows its progress bar; other rows the gauge (P7-19).
    if (server.seed && server.seedBar && facts.players !== null)
        lines.push(
            `${server.seedBar} **${number(facts.players)} / ${number(server.seed.liveFrom)}**`
        )
    else if (gauge) lines.push(gauge)
    // P2-43, P2-45: how to join, public data only (never a password).
    const code = (value: string) => `\`${value.replace(/`/g, "ˋ")}\``
    if (facts.game === "hell_let_loose" && server.address)
        lines.push(`${copy.address} ${code(server.address)}`)
    if (facts.game === "wardogs" && server.joinCode)
        lines.push(`${copy.joinCode} ${code(server.joinCode)}`)
    return lines.join("\n")
}

/**
 * How many rows may carry their map: a row with a thumbnail is a section
 * (three components instead of one) and the whole message holds at most 40
 * components, so the first rows keep their map while it fits.
 */
export function combinedThumbnailBudget(input: {
    servers: number
    joinButtons: number
    banner: boolean
    description: boolean
}) {
    const rows = Math.ceil(input.joinButtons / 5)
    const base =
        1 + // container
        1 + // header
        (input.banner ? 1 : 0) +
        (input.description ? 1 : 0) +
        input.servers + // one text per row
        Math.max(0, input.servers - 1) + // dividers between rows
        1 + // divider above the buttons
        rows +
        input.joinButtons +
        1 // footer
    return Math.max(
        0,
        Math.min(
            input.servers,
            Math.floor((DISCORD_MESSAGE_LIMITS.components - base) / 2)
        )
    )
}

export function combinedPanelView(input: CombinedPanelInput): MessageView {
    const { copy } = input
    const fields: MessageField[] = input.servers.map((server) => {
        const state = liveServerState(server.facts, {
            paused: server.paused,
            seedActive: Boolean(server.seed),
            liveFrom: server.seed?.liveFrom ?? server.liveFrom,
        })
        return {
            title: server.title,
            chip: liveStateChip(state, copy),
            text: rowText(server, input),
        }
    })
    // P7-20, P4-38: one join button per server. A Wardogs button opens the
    // join page, which shows the join code (P4-46), so P2-39 holds too.
    const joins: MessageButton[] = input.servers
        .filter(
            (server) =>
                server.joinUrl &&
                server.joinable &&
                server.facts.freshness !== "unavailable"
        )
        .map((server) => ({
            kind: "link" as const,
            url: server.joinUrl!,
            // "Připojit se: Vlci #1" (P2-45, P7-20): the name before " · ".
            label:
                input.servers.length > 1
                    ? copy.buttons.joinServer(
                          server.title.split(" · ")[0]?.trim() || server.title
                      )
                    : copy.buttons.join,
        }))
    const description = input.description?.trim()
    const style = input.style ?? "a"
    const banner = style === "b" ? input.banner : null
    // Style C is text only (P7-12).
    const thumbnails =
        style === "c"
            ? 0
            : combinedThumbnailBudget({
                  servers: input.servers.length,
                  joinButtons: Math.min(joins.length, 10),
                  banner: Boolean(banner),
                  description: Boolean(description),
              })
    input.servers.forEach((server, index) => {
        const field = fields[index]
        if (
            field &&
            server.thumbnail &&
            index < thumbnails &&
            server.facts.freshness !== "unavailable"
        )
            field.thumbnail = server.thumbnail
    })
    const dataAt = Math.max(
        0,
        ...input.servers.map((server) => server.facts.dataAt ?? 0)
    )
    const view = panelFrame({
        accentColor: input.accentColor,
        label: `${copy.labelCombined} · ${input.clanName}`,
        title: input.title?.trim() || copy.combinedTitle,
        content: [
            ...(description
                ? [{ kind: "text" as const, markdown: description }]
                : []),
            ...(fields.length
                ? [{ kind: "fields" as const, items: fields }]
                : []),
        ],
        actions: combinedPanelJoinRows(joins).slice(0, 2),
        updatedAt: input.footerTiming ? dataAt || input.now : "",
        refreshSeconds: input.footerTiming ? PANEL_REFRESH_SECONDS : undefined,
    })
    // P7-19: in style B the banner is the top of the card and names the panel.
    if (banner) {
        view.lead = banner
        if (view.header) {
            view.header.label = undefined
            view.header.title = undefined
        }
    }
    return view
}
