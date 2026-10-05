import {
    hllLayerLighting,
    hllModeOf,
    hllNationsFor,
    minutesLeft,
    panelMapDefinition,
    panelMapKey,
    playerGauge,
    playerGaugeEmoji,
    type HllLighting,
    type HllMode,
    type PanelStyle,
} from "./panel-graphics"
import {
    escapeMarkdownText,
    panelFrame,
    type MessageBlock,
    type MessageButton,
    type MessageChip,
    type MessageMedia,
    type MessageView,
} from "../discord-messages/message-view"
import {
    WARDOGS_FACTIONS,
    type HllNation,
    type HllSide,
    type PanelEmojiKey,
    type WardogsFaction,
} from "./panel-emblems"
import {
    PANEL_REFRESH_SECONDS,
    type PanelContent,
    type PanelGame,
} from "./settings"
import type { WarconRead } from "../game-data/warcon-contracts"
import type { ServerSnapshot } from "../game-data/contracts"
import type { PanelLayout } from "./panel-presentation"
import type { HllLive } from "../game-data/hll-live"
import { panelImageCopy } from "./panel-image-copy"
import type { LivePanelCopy } from "./panel-copy"

/**
 * The live server panel (boards P4, L3-33..49, P5-15..19, P7): one message
 * per game server that the bot edits every 60 s. The same view is the text
 * under the style A image, the style B card and the compact style C; the
 * dashboard preview renders exactly what the bot posts. Data only from the
 * server: what the provider does not report is left out (P4-02).
 */

export type WarconLiveData = Extract<WarconRead, { view: "live" }>["data"]
export type LiveFreshness = "fresh" | "stale" | "unavailable"

/** One connected player of the current round. */
export type LivePlayer = {
    id: string | null
    name: string
    /** HLL side (`allies`/`axis`) or the Wardogs faction name. */
    side: string | null
    kills: number | null
    deaths: number | null
    cash: number | null
}

/** Provider-independent facts of one server, read for one pass. */
export type LiveServerFacts = {
    game: PanelGame
    serverName: string | null
    /** fresh: answering now; stale: older data shown; unavailable: no answer. */
    freshness: LiveFreshness
    /** When the shown data was read, ms. */
    dataAt: number | null
    map: { name: string; key: string | null } | null
    mode: HllMode | null
    lighting: HllLighting | null
    nextMap: {
        name: string
        mode: HllMode | null
        lighting: HllLighting | null
    } | null
    players: number | null
    capacity: number | null
    queue: number | null
    timeLeftSeconds: number | null
    hll: {
        allies: number | null
        axis: number | null
        nations: Record<HllSide, HllNation>
    } | null
    wardogs: {
        factions: Array<{
            key: WardogsFaction | null
            name: string
            points: number
        }>
    } | null
    roster: LivePlayer[]
    /** The roster is the current round's and fresh. */
    rosterFresh: boolean
    rosterAt: number | null
}

const time = (value: string | null | undefined) => {
    const ms = value ? Date.parse(value) : NaN
    return Number.isFinite(ms) ? ms : null
}
const finite = (value: number | null | undefined) =>
    typeof value === "number" && Number.isFinite(value) ? value : null

/** Catalogue map name ("Sainte-Mère-Église") or the provider's own text. */
function mapOf(game: PanelGame, raw: string | null | undefined) {
    const text = raw?.trim()
    if (!text) return null
    const key = panelMapKey(game, text)
    return { name: panelMapDefinition(game, key)?.name ?? text, key }
}

/** Lighting written as a word ("day", "Night"); null when not reported. */
export function lightingOf(value: string | null | undefined) {
    return hllLayerLighting(value?.replace(/[^A-Za-z]+/g, "_") ?? null)
}

function wardogsFactionKey(name: string | null | undefined) {
    const key = name?.trim().toLowerCase()
    return (WARDOGS_FACTIONS as readonly string[]).includes(key ?? "")
        ? (key as WardogsFaction)
        : null
}

/** Facts from a CRCON live read (HLL). */
export function hllLiveFacts(data: HllLive): LiveServerFacts {
    const status = data.status
    const map = mapOf("hell_let_loose", status?.layerId ?? status?.map)
    const named = status?.map ? mapOf("hell_let_loose", status.map) : null
    const next = status?.nextMap
        ? mapOf("hell_let_loose", status.nextMap.layerId ?? status.nextMap.name)
        : null
    const score = (side: HllSide) =>
        status?.scores.find((entry) => entry.team === side)?.score ?? null
    return {
        game: "hell_let_loose",
        serverName: status?.serverName ?? null,
        freshness: status ? data.statusFreshness : "unavailable",
        dataAt: time(data.statusAt),
        map: map ?? named,
        mode: hllModeOf(status?.mode ?? status?.layerId),
        lighting:
            lightingOf(status?.environment) ??
            hllLayerLighting(status?.layerId),
        nextMap:
            status?.nextMap && next
                ? {
                      name: next.name,
                      mode: hllModeOf(
                          status.nextMap.mode ?? status.nextMap.layerId
                      ),
                      lighting:
                          lightingOf(status.nextMap.environment) ??
                          hllLayerLighting(status.nextMap.layerId),
                  }
                : null,
        players: status?.playerCount ?? null,
        capacity: status?.maxPlayers ?? null,
        queue: status?.queueCount ?? null,
        timeLeftSeconds: finite(status?.timeRemainingSeconds),
        hll: status
            ? {
                  allies: score("allies"),
                  axis: score("axis"),
                  nations: hllNationsFor(map?.key ?? named?.key),
              }
            : null,
        wardogs: null,
        roster: data.players.map((player) => ({
            id: player.playerId,
            name: player.name,
            side: player.team,
            kills: finite(player.kills),
            deaths: finite(player.deaths),
            cash: null,
        })),
        rosterFresh: data.playersFreshness === "fresh",
        rosterAt: time(data.playersAt),
    }
}

/** Facts from a Warcon live read (Wardogs). */
export function wardogsLiveFacts(data: WarconLiveData): LiveServerFacts {
    const status = data.status
    return {
        game: "wardogs",
        serverName: status?.serverName ?? null,
        freshness: status ? data.freshness : "unavailable",
        dataAt: time(data.statusAt ?? data.observedAt),
        map: mapOf("wardogs", status?.map),
        mode: null,
        lighting: lightingOf(status?.lighting),
        nextMap: null,
        players: status?.playerCount ?? null,
        capacity: status?.maxPlayers ?? null,
        queue: null,
        timeLeftSeconds: null,
        hll: null,
        wardogs: status
            ? {
                  factions: status.scores.map((score) => ({
                      key: wardogsFactionKey(score.name),
                      name: score.name,
                      points: Math.round(score.score),
                  })),
              }
            : null,
        roster: data.players.map((player) => ({
            id: player.steamId,
            name: player.name,
            side: player.faction,
            kills: player.kills,
            deaths: player.deaths,
            cash: player.cash,
        })),
        rosterFresh: data.playersFreshness === "fresh",
        rosterAt: time(data.playersAt),
    }
}

/**
 * Facts from the collected snapshot, when there is no live read (another
 * provider, a failed read, the combined panel). No roster and no leaders.
 */
export function snapshotLiveFacts(snapshot: ServerSnapshot): LiveServerFacts {
    const game = snapshot.gameId
    const map = mapOf(game, snapshot.map)
    const label = (id: string) =>
        snapshot.scores.find(
            (score) =>
                score.id.toLowerCase().startsWith(id) ||
                score.label.toLowerCase().startsWith(id)
        )?.score ?? null
    return {
        game,
        serverName: snapshot.displayName,
        freshness: snapshot.freshness,
        dataAt: time(snapshot.observedAt),
        map,
        mode: game === "hell_let_loose" ? hllModeOf(snapshot.map) : null,
        lighting: null,
        nextMap: null,
        players: snapshot.players,
        capacity: snapshot.capacity,
        queue: null,
        timeLeftSeconds: null,
        hll:
            game === "hell_let_loose"
                ? {
                      allies: finite(label("allie")),
                      axis: finite(label("axis")),
                      nations: hllNationsFor(map?.key),
                  }
                : null,
        wardogs:
            game === "wardogs"
                ? {
                      factions: snapshot.scores.flatMap((score) =>
                          score.score === null
                              ? []
                              : [
                                    {
                                        key: wardogsFactionKey(score.label),
                                        name: score.label,
                                        points: Math.round(score.score),
                                    },
                                ]
                      ),
                  }
                : null,
        roster: [],
        rosterFresh: false,
        rosterAt: null,
    }
}

// ---- State -------------------------------------------------------------------

/** P4-B01 plus "Starší data" for an answer older than a pass (P2-45). */
export const LIVE_PANEL_STATES = [
    "live",
    "empty",
    "seeding",
    "offline",
    "paused",
    "stale",
] as const
export type LivePanelState = (typeof LIVE_PANEL_STATES)[number]

/**
 * Pozastaveno wins (an admin stopped it); a server that does not answer is
 * Nedostupný; a running seed below the threshold is Seedujeme; nobody on the
 * server is Prázdný; old data is "Starší data"; otherwise Živě.
 */
export function liveServerState(
    facts: Pick<LiveServerFacts, "freshness" | "players">,
    input: { paused: boolean; seedActive: boolean; liveFrom: number }
): LivePanelState {
    if (input.paused) return "paused"
    if (facts.freshness === "unavailable") return "offline"
    if (input.seedActive && (facts.players ?? 0) < input.liveFrom)
        return "seeding"
    if ((facts.players ?? 0) <= 0) return "empty"
    if (facts.freshness === "stale") return "stale"
    return "live"
}

const STATE_TONES: Record<LivePanelState, MessageChip["tone"]> = {
    live: "success",
    empty: "neutral",
    seeding: "warning",
    offline: "danger",
    paused: "neutral",
    stale: "warning",
}
export function liveStateChip(
    state: LivePanelState,
    copy: LivePanelCopy,
    statusMode = false
): MessageChip {
    const label =
        state === "live" && statusMode ? copy.state.online : copy.state[state]
    return { label, tone: STATE_TONES[state] }
}

// ---- View --------------------------------------------------------------------

/** Installed application emoji by key (W2's fixed sign set). */
export type PanelEmojiMarkup = Partial<Record<PanelEmojiKey, string>>

const SIDE_GLYPH: Record<HllSide, string> = { allies: "★", axis: "✚" }
const WARDOGS_GLYPH = "◈"

/** The sign of an HLL side: the map's nation emoji, the side emoji, else ★/✚. */
export function hllSideSign(
    side: HllSide,
    nations: Record<HllSide, HllNation> | null,
    emoji: PanelEmojiMarkup
) {
    const nation = nations?.[side]
    return (
        (nation ? emoji[nation] : undefined) ?? emoji[side] ?? SIDE_GLYPH[side]
    )
}
/** The sign of a Wardogs faction: its emoji, else the neutral marker. */
export function wardogsSign(
    faction: WardogsFaction | null,
    emoji: PanelEmojiMarkup
) {
    return (faction ? emoji[faction] : undefined) ?? WARDOGS_GLYPH
}

const formatNumber = (value: number, locale: string) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value)
const code = (value: string) => `\`${value.replace(/`/g, "ˋ")}\``
const at = (ms: number, style: "R" | "t" | "f") =>
    `<t:${Math.floor(ms / 1000)}:${style}>`
const name = (value: string, max = 40) =>
    escapeMarkdownText(Array.from(value).slice(0, max).join(""))

export type LiveServerPanelInput = {
    copy: LivePanelCopy
    language: string
    panel: {
        id: string
        revision: number
        title: string | null
        description: string | null
        showPlayers: boolean
        showLeaders: boolean
        reportEnabled: boolean
        layout: PanelLayout
        content: PanelContent
        /** The panel's own bar colour; null uses the clan colour. */
        accentColor: string | null
        style: PanelStyle
    }
    facts: LiveServerFacts
    now: number
    /** An admin paused the panel ("Pozastaveno", grey). */
    paused: boolean
    /** `@everyone` cannot view the channel: clan-only facts may show. */
    privateChannel: boolean
    seed: {
        startedAt: number
        liveFrom: number
        bar: string
        /** Link to the call message in the seed channel. */
        callUrl: string | null
        channelId: string | null
    } | null
    /** The seed channel of the server's plan, for the empty-state hint. */
    seedChannelId: string | null
    liveFrom: number
    /** A Logi match running on this server (P4-23, L3-35). */
    match: {
        title: string
        category: string | null
        startedAt: number
        allies: string | null
        axis: string | null
    } | null
    /** Players matched to clan members through linked Steam (P4-25). */
    clanPlayers: string[] | null
    server: {
        address: string | null
        joinCode: string | null
        /** Only ever passed for a private channel with the switch on. */
        password: string | null
        joinUrl: string | null
    }
    newMap: boolean
    emoji: PanelEmojiMarkup
    images: {
        /** Style A score image (`attachment://skore-….png`). */
        score: MessageMedia | null
        /** Style B banner. */
        banner: MessageMedia | null
        /** Map thumbnail. */
        thumbnail: MessageMedia | null
    }
    /** Custom ID of the player list and report buttons. */
    ids: { players: string; report: string }
}

/** "Foy · Warfare · Den" from what the server reports. */
export function liveMapLine(
    facts: Pick<LiveServerFacts, "map" | "mode" | "lighting">,
    language: string
) {
    const words = panelImageCopy(language)
    return [
        facts.map?.name,
        facts.mode ? words.mode[facts.mode] : null,
        facts.lighting ? words.lighting[facts.lighting] : null,
    ]
        .filter((part): part is string => Boolean(part))
        .map((part) => escapeMarkdownText(part))
        .join(" · ")
}
function nextMapText(
    next: NonNullable<LiveServerFacts["nextMap"]>,
    language: string
) {
    const words = panelImageCopy(language)
    return [
        next.name,
        next.mode ? words.mode[next.mode] : null,
        next.lighting ? words.lighting[next.lighting] : null,
    ]
        .filter((part): part is string => Boolean(part))
        .map((part) => escapeMarkdownText(part))
        .join(" · ")
}

/** "78 / 100 hráčů · fronta 3 · zbývá 47 min" for the header. */
function playersDetail(
    input: LiveServerPanelInput,
    state: LivePanelState,
    withMap: boolean
) {
    const { copy, facts, panel } = input
    const locale = panelImageCopy(input.language).locale
    const count = (value: number) => formatNumber(value, locale)
    if (state === "offline")
        return [
            copy.serverNotResponding,
            facts.dataAt ? copy.lastData(at(facts.dataAt, "f")) : null,
        ]
            .filter(Boolean)
            .join(" · ")
    const parts: string[] = []
    if (withMap && panel.layout.showMap && facts.map)
        parts.push(escapeMarkdownText(facts.map.name))
    if (
        panel.layout.showPlayerCount &&
        facts.players !== null &&
        facts.capacity !== null
    )
        parts.push(copy.players(count(facts.players), count(facts.capacity)))
    if (state === "seeding") parts.push(copy.liveFrom(count(input.liveFrom)))
    else if (state === "paused" || state === "stale") {
        if (state === "paused") parts.unshift(copy.pausedByAdmin)
        if (facts.dataAt) parts.push(copy.lastData(at(facts.dataAt, "f")))
    } else if (state === "live") {
        if (panel.content.queue && facts.queue)
            parts.push(copy.queue(count(facts.queue)))
        const minutes = minutesLeft(facts.timeLeftSeconds)
        if (minutes !== null) parts.push(copy.timeLeft(String(minutes)))
    }
    return parts.join(" · ")
}

/** "Spojenci ★ 3 : 2 ✚ Osa", with team codes when a Logi match runs. */
function hllScoreLine(input: LiveServerPanelInput) {
    const { facts, copy, emoji } = input
    const hll = facts.hll
    if (!hll || hll.allies === null || hll.axis === null) return null
    const team = (value: string | null | undefined) =>
        value ? `**${name(value, 12)}** ` : ""
    const match = input.match
    return [
        `${team(match?.allies)}${copy.allies} ${hllSideSign("allies", hll.nations, emoji)}`,
        `**${hll.allies} : ${hll.axis}**`,
        `${hllSideSign("axis", hll.nations, emoji)} ${copy.axis}${match?.axis ? ` **${name(match.axis, 12)}**` : ""}`,
    ].join("  ")
}

function wardogsFactionLines(input: LiveServerPanelInput) {
    const factions = input.facts.wardogs?.factions ?? []
    return factions.map(
        (faction) =>
            `${wardogsSign(faction.key, input.emoji)} ${name(faction.name, 24)} **${faction.points}** ${input.copy.points}`
    )
}

function sideSignOf(input: LiveServerPanelInput, side: string | null) {
    if (input.facts.game === "hell_let_loose")
        return side === "allies" || side === "axis"
            ? hllSideSign(side, input.facts.hll?.nations ?? null, input.emoji)
            : ""
    return wardogsSign(wardogsFactionKey(side), input.emoji)
}

/** Top three players by a metric, ties by name (never reorder between passes). */
export function liveLeaders(
    roster: readonly LivePlayer[],
    metric: "kills" | "cash"
) {
    return roster
        .filter((player) => typeof player[metric] === "number")
        .slice()
        .sort(
            (a, b) =>
                (b[metric] as number) - (a[metric] as number) ||
                a.name.localeCompare(b.name, "en")
        )
        .slice(0, 3)
}

function leaderBlocks(input: LiveServerPanelInput): MessageBlock[] {
    const { facts, copy, panel } = input
    if (!panel.showLeaders || !facts.rosterFresh || !facts.roster.length)
        return []
    const locale = panelImageCopy(input.language).locale
    const line = (metric: "kills" | "cash") =>
        liveLeaders(facts.roster, metric)
            .map((player) => {
                const sign = sideSignOf(input, player.side)
                return `${sign ? `${sign} ` : ""}${name(player.name, 28)} · ${formatNumber(player[metric] as number, locale)}`
            })
            .join("  ")
    const blocks: MessageBlock[] = []
    const kills = line("kills")
    if (kills)
        blocks.push({
            kind: "text",
            markdown: `**${copy.topKills}**\n${kills}`,
        })
    if (facts.game === "wardogs") {
        const cash = line("cash")
        if (cash)
            blocks.push({
                kind: "text",
                markdown: `**${copy.topCash}**\n${cash}`,
            })
    }
    return blocks
}

function connectionLines(input: LiveServerPanelInput) {
    const { server, copy, panel, facts } = input
    const lines: string[] = []
    if (
        panel.content.address &&
        facts.game === "hell_let_loose" &&
        server.address
    )
        lines.push(`${copy.address} ${code(server.address)}`)
    if (panel.content.joinCode && facts.game === "wardogs" && server.joinCode)
        lines.push(`${copy.joinCode} ${code(server.joinCode)}`)
    // The password reaches the view only for a private channel (P4-B06).
    if (
        input.privateChannel &&
        panel.content.password &&
        server.password &&
        facts.game === "hell_let_loose"
    )
        lines.push(`${copy.password} ${code(server.password)}`)
    return lines
}

function joinButton(input: LiveServerPanelInput): MessageButton | null {
    const { server, panel, facts } = input
    const reachable =
        facts.game === "hell_let_loose" ? server.address : server.joinCode
    return panel.content.joinButton && server.joinUrl && reachable
        ? { kind: "link", url: server.joinUrl, label: input.copy.buttons.join }
        : null
}

function gaugeLine(input: LiveServerPanelInput) {
    const { facts } = input
    if (facts.players === null || facts.capacity === null) return null
    const gauge = playerGauge({
        players: facts.players,
        capacity: facts.capacity,
        queue: input.panel.content.queue ? facts.queue : null,
    })
    if (!gauge) return null
    const words = panelImageCopy(input.language)
    return `${playerGaugeEmoji(gauge, {
        players: input.emoji.gauge_players,
        queue: input.emoji.gauge_queue,
        free: input.emoji.gauge_free,
    })} ${words.gauge(facts.players, facts.capacity, {
        queue: input.panel.content.queue ? facts.queue : null,
    })}`
}

/**
 * The live server panel. Style A puts the generated score image on top with
 * a short text summary under it; style B adds the banner and the player
 * gauge; style C is the compact text. Without the score image style A falls
 * back to the full text card, so the panel is never empty.
 */
export function liveServerPanelView(input: LiveServerPanelInput): MessageView {
    const { copy, facts, panel } = input
    const statusMode = !panel.layout.showScoreboard
    const seedActive = Boolean(input.seed && panel.content.seedProgress)
    const state = liveServerState(facts, {
        paused: input.paused,
        seedActive,
        liveFrom: input.seed?.liveFrom ?? input.liveFrom,
    })
    const words = panelImageCopy(input.language)
    const label = `${
        input.privateChannel
            ? copy.labelClan
            : statusMode
              ? copy.labelStatus
              : copy.labelLive
    } · ${copy.game[facts.game]}`
    const title = panel.title?.trim() || facts.serverName?.trim() || "—"
    // Style A without its image falls back to the full text card.
    const style: PanelStyle | "fallback" =
        panel.style === "a" && !input.images.score ? "fallback" : panel.style
    const mapInHeader = facts.game === "wardogs" || statusMode
    const detail = playersDetail(input, state, mapInHeader)
    const content: MessageBlock[] = []
    const description = panel.description?.trim()
    const showLive = state !== "offline"
    const players = facts.players ?? 0
    const mapLine = liveMapLine(facts, input.language)
    const nextMap =
        panel.content.nextMap && facts.nextMap
            ? nextMapText(facts.nextMap, input.language)
            : null

    if (style === "a" && input.images.score)
        content.push({ kind: "gallery", items: [input.images.score] })
    if (style === "b" && input.images.banner)
        content.push({ kind: "gallery", items: [input.images.banner] })
    if (description && showLive)
        content.push({ kind: "text", markdown: description })

    if (state === "offline") {
        content.push({ kind: "text", markdown: copy.offlineText })
    } else if (style === "c") {
        const score = hllScoreLine(input)
        const line = [
            panel.layout.showMap ? mapLine : null,
            statusMode
                ? null
                : (score ?? wardogsFactionLines(input).join("  ")),
        ]
            .filter(Boolean)
            .join(" · ")
        if (line) content.push({ kind: "text", markdown: line })
        const gauge = gaugeLine(input)
        if (gauge) content.push({ kind: "text", markdown: gauge })
    } else if (style === "a" && input.images.score) {
        // P7-08: the image carries the leaders; the text stays readable.
        const summary = [
            panel.layout.showMap ? mapLine : null,
            nextMap ? copy.nextMapInline(nextMap) : null,
            statusMode ? null : hllScoreLine(input)?.replace(/\*\*/g, ""),
        ]
            .filter(Boolean)
            .join(" · ")
        if (summary) content.push({ kind: "text", markdown: summary })
    } else {
        if (
            input.privateChannel &&
            input.match &&
            state !== "empty" &&
            state !== "paused"
        )
            content.push({
                kind: "fields",
                items: [
                    {
                        title: input.match.title,
                        ...(input.match.category
                            ? {
                                  chip: {
                                      label: input.match.category,
                                      tone: "info" as const,
                                  },
                              }
                            : {}),
                        text: copy.matchRunning(at(input.match.startedAt, "t")),
                    },
                ],
            })
        if (state === "seeding" && input.seed) {
            const locale = words.locale
            content.push({
                kind: "text",
                markdown: `${input.seed.bar} **${formatNumber(players, locale)} / ${formatNumber(input.seed.liveFrom, locale)}**`,
            })
            const channel = input.seed.channelId
                ? `<#${input.seed.channelId}>`
                : null
            content.push({
                kind: "text",
                markdown: [
                    copy.seedJoin,
                    `${copy.seedRunning(at(input.seed.startedAt, "t"))}${channel ? ` ${copy.seedCallIn(channel)}` : ""}`,
                ].join("\n"),
            })
        }
        if (state === "empty") {
            if (panel.layout.showMap && mapLine && !mapInHeader)
                content.push({ kind: "text", markdown: mapLine })
            content.push({
                kind: "text",
                markdown: [
                    copy.emptyText,
                    input.seedChannelId
                        ? copy.emptySeedHint(`<#${input.seedChannelId}>`)
                        : null,
                ]
                    .filter(Boolean)
                    .join(" "),
            })
        } else {
            const privateNext =
                input.privateChannel && nextMap
                    ? ` · ${copy.nextMapInline(nextMap)}`
                    : ""
            if (panel.layout.showMap && mapLine && !mapInHeader)
                content.push({
                    kind: "text",
                    markdown: `${mapLine}${privateNext}`,
                })
            if (!statusMode && state !== "seeding") {
                const score =
                    facts.game === "hell_let_loose"
                        ? hllScoreLine(input)
                        : wardogsFactionLines(input).join("\n")
                if (score) content.push({ kind: "text", markdown: score })
            }
            if (
                input.privateChannel &&
                input.clanPlayers?.length &&
                state !== "paused"
            )
                content.push({
                    kind: "text",
                    markdown: `**${copy.clanPlaying(String(input.clanPlayers.length))}**\n${input.clanPlayers
                        .slice(0, 40)
                        .map((player) => name(player, 32))
                        .join(" · ")}`,
                })
            if (!statusMode && state !== "seeding")
                content.push(...leaderBlocks(input))
            if (nextMap && !input.privateChannel && state !== "seeding")
                content.push({ kind: "text", markdown: copy.nextMap(nextMap) })
        }
        if (style === "b") {
            const gauge = gaugeLine(input)
            if (gauge) content.push({ kind: "text", markdown: gauge })
        }
    }
    if (showLive) {
        const lines = connectionLines(input)
        if (lines.length)
            content.push({ kind: "text", markdown: lines.join("\n") })
    }

    const buttons: MessageButton[] = []
    if (state !== "offline") {
        const join = joinButton(input)
        if (join) buttons.push(join)
        const interactive =
            state !== "paused" &&
            state !== "empty" &&
            state !== "seeding" &&
            players > 0 &&
            facts.rosterFresh &&
            facts.roster.length > 0
        if (interactive && panel.showPlayers && !statusMode)
            buttons.push({
                kind: "action",
                id: input.ids.players,
                label: copy.buttons.players,
                style: "secondary",
            })
        if (
            interactive &&
            panel.reportEnabled &&
            !input.privateChannel &&
            !statusMode
        )
            buttons.push({
                kind: "action",
                id: input.ids.report,
                label: copy.buttons.report,
                style: "secondary",
            })
        if (state === "seeding" && input.seed?.callUrl)
            buttons.push({
                kind: "link",
                url: input.seed.callUrl,
                label: copy.buttons.openCall,
            })
    }

    // Style C is the shortest message, without images (P7-12).
    const thumbnail =
        panel.layout.showMap &&
        style !== "c" &&
        !(style === "a" && input.images.score) &&
        state !== "offline"
            ? (input.images.thumbnail ?? undefined)
            : undefined
    const refreshing =
        panel.content.footerTiming &&
        state !== "offline" &&
        state !== "paused" &&
        style !== "c"
    const view = panelFrame({
        accentColor: panel.accentColor,
        label,
        title,
        state: {
            chip: liveStateChip(state, copy, statusMode),
            detail: detail || undefined,
        },
        image: thumbnail,
        content,
        actions: buttons.length ? [buttons] : [],
        updatedAt: panel.content.footerTiming
            ? (facts.dataAt ?? input.now)
            : "",
        refreshSeconds: refreshing ? PANEL_REFRESH_SECONDS : undefined,
    })
    if (input.newMap && state !== "offline" && view.header)
        view.header.chips = [
            ...(view.header.chips ?? []),
            { label: copy.newMap, tone: "info" },
        ]
    return view
}
