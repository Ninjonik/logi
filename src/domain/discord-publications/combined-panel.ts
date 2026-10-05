import {
    escapeMarkdownText,
    panelFrame,
    type MessageButton,
    type MessageField,
    type MessageMedia,
    type MessageView,
} from "../discord-messages/message-view"
import {
    liveServerState,
    liveStateChip,
    type LiveServerFacts,
} from "./live-panel"
import { combinedPanelJoinRows, minutesLeft } from "./panel-graphics"
import { panelImageCopy } from "./panel-image-copy"
import { PANEL_REFRESH_SECONDS } from "./settings"
import type { LivePanelCopy } from "./panel-copy"

/**
 * "Naše servery" (P4-37..39, P4-B08, P7-19/20, P7-B09): one optional message
 * listing several servers, each still keeping its own panel. Public data
 * only: no password, no player names and no Logi match. A section holds one
 * accessory, so the join buttons stand in a bottom row, five per row.
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
}

export type CombinedPanelInput = {
    copy: LivePanelCopy
    language: string
    clanName: string
    title: string | null
    description: string | null
    accentColor: string | null
    footerTiming: boolean
    servers: CombinedServer[]
    now: number
    banner: MessageMedia | null
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
    if (facts.map) parts.push(escapeMarkdownText(facts.map.name))
    if (facts.players !== null && facts.capacity !== null)
        parts.push(
            copy.playersShort(number(facts.players), number(facts.capacity))
        )
    if (server.seed) parts.push(copy.liveFrom(number(server.seed.liveFrom)))
    else if (facts.queue) parts.push(copy.queue(number(facts.queue)))
    const minutes = minutesLeft(facts.timeLeftSeconds)
    if (minutes !== null && !server.seed && (facts.players ?? 0) > 0)
        parts.push(copy.timeLeft(String(minutes)))
    if (facts.freshness === "stale" && facts.dataAt)
        parts.push(copy.lastData(`<t:${Math.floor(facts.dataAt / 1000)}:R>`))
    return parts.join(" · ")
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
    const joins: MessageButton[] = input.servers
        .filter((server) => server.joinUrl && server.joinable)
        .map((server) => ({
            kind: "link" as const,
            url: server.joinUrl!,
            label:
                input.servers.length > 1
                    ? copy.buttons.joinServer(server.title)
                    : copy.buttons.join,
        }))
    const dataAt = Math.max(
        0,
        ...input.servers.map((server) => server.facts.dataAt ?? 0)
    )
    const description = input.description?.trim()
    return panelFrame({
        accentColor: input.accentColor,
        label: `${copy.labelCombined} · ${input.clanName}`,
        title: input.title?.trim() || copy.combinedTitle,
        content: [
            ...(input.banner
                ? [{ kind: "gallery" as const, items: [input.banner] }]
                : []),
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
}
